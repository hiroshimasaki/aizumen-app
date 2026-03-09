const imageService = require('./imageService');
const vectorService = require('./vectorService');
const { supabaseAdmin } = require('../../config/supabase');
const aiService = require('../aiService'); // 既存のVertex AI / Gemini設定を利用
const logService = require('../logService');

class DrawingSearchService {
    /**
     * 図面の登録（インデックス作成）
     * @param {string} quotationId 
     * @param {string} fileId 
     * @param {string} tenantId 
     * @param {Buffer} fileBuffer 
     */
    async registerDrawing(quotationId, fileId, tenantId, fileBuffer, mimeType = 'application/pdf') {
        try {
            console.log(`[DrawingSearch] Indexing drawing for quotation: ${quotationId} (${mimeType})`);

            // 1. 前処理 (PDFなら画像変換も含む)
            const processedBuffer = await imageService.preprocessImage(fileBuffer, mimeType);

            // 2. タイル分割
            const tiles = await imageService.tileImage(processedBuffer);
            console.log(`[DrawingSearch] Generated ${tiles.length} tiles.`);

            // 3. 各タイルの埋め込み生成と保存
            const insertData = [];
            for (const tile of tiles) {
                const embedding = await vectorService.getEmbedding(tile.buffer);

                insertData.push({
                    quotation_id: quotationId,
                    file_id: fileId,
                    tenant_id: tenantId,
                    tile_index: tile.index,
                    x: tile.x,
                    y: tile.y,
                    width: tile.width,
                    height: tile.height,
                    embedding: embedding
                });
            }

            // Supabaseへ一括保存
            const { error } = await supabaseAdmin
                .from('drawing_tiles')
                .insert(insertData);

            if (error) throw error;
            console.log(`[DrawingSearch] Successfully indexed ${tiles.length} tiles for ${quotationId}`);
        } catch (error) {
            console.error('[DrawingSearch] Registration failed:', error);
            throw error;
        }
    }

    /**
     * 類似図面の検索
     * @param {string} tenantId 
     * @param {Buffer} queryImageBuffer ユーザーが切り抜いた画像
     * @returns {Promise<Array>} 類似箇所のリスト
     */
    async searchSimilarDrawing(tenantId, queryImageBuffer) {
        try {
            // 1. クエリ画像の特徴量生成
            const processedQuery = await imageService.preprocessImage(queryImageBuffer);
            const queryEmbedding = await vectorService.getEmbedding(processedQuery);

            // 2. pgvector を使用した一次検索（コサイン類似度）
            // 注: supabase-js 経由でベクトル検索を行うには rpc を使用するのが一般的です
            const { data: candidates, error } = await supabaseAdmin.rpc('match_drawing_tiles', {
                query_embedding: queryEmbedding,
                match_threshold: 0.4,
                match_count: 40, // 20から40に拡大。名寄せ後に上位を残すため。
                p_tenant_id: tenantId
            });

            if (error) throw error;

            if (!candidates || candidates.length === 0) {
                console.log('[DrawingSearch] No candidates found in vector search.');
                return [];
            }

            // 2.5 同一ファイル内での名寄せ（デデュプリケーション）
            // 同じ図面から複数のタイルがヒットした場合、最もスコアが高いものだけを残す
            const uniqueFileCandidates = [];
            const seenFileIds = new Set();
            
            // スコア（similarity）順に並んでいる前提
            for (const c of candidates) {
                if (!seenFileIds.has(c.file_id)) {
                    uniqueFileCandidates.push(c);
                    seenFileIds.add(c.file_id);
                    // Geminiに送る最大数に達したら終了（多様性を確保しつつ件数を絞る）
                    if (uniqueFileCandidates.length >= 10) break;
                }
            }
            
            logService.debug(`[DrawingSearch] Deduplicated candidates: ${candidates.length} -> ${uniqueFileCandidates.length}`);

            // 2.6 storage_path / mime_type / original_name の補填
            const fileIds = [...new Set(uniqueFileCandidates.map(c => c.file_id))];
            const { data: files } = await supabaseAdmin
                .from('quotation_files')
                .select('id, storage_path, mime_type, original_name')
                .in('id', fileIds);
            
            const enhancedCandidates = uniqueFileCandidates.map(c => {
                const file = files?.find(f => f.id === c.file_id);
                return {
                    ...c,
                    storage_path: c.storage_path || file?.storage_path,
                    mime_type: c.mime_type || file?.mime_type,
                    original_name: c.original_name || file?.original_name
                };
            });

            // 3. Gemini による二次精査（リランキング）
            const rerankedResults = await this.rerankWithGemini(queryImageBuffer, enhancedCandidates);

            return rerankedResults;
        } catch (error) {
            console.error('[DrawingSearch] Search failed:', error);
            throw error;
        }
    }

    /**
     * Geminiを使用したリランキング
     */
    async rerankWithGemini(queryBuffer, candidates) {
        try {
            // 各候補のタイル画像をバイナリデータとして取得（上位10件に拡大）
            const candidateImages = await Promise.all(candidates.slice(0, 10).map(async (c, i) => {
                try {
                    if (!c.storage_path) return null;
                    const { data: fileData } = await supabaseAdmin.storage
                        .from('quotation-files')
                        .download(c.storage_path);
                    if (!fileData) return null;

                    const buffer = Buffer.from(await fileData.arrayBuffer());
                    logService.debug(`[DrawingSearch] Fetched candidate ${i} from storage: ${buffer.length} bytes`);
                    
                    // Gemini 判定用に、広い範囲（コンテキスト）を切り出す
                    // 元のタイルサイズ(300x300相当)の 3倍 程度にする
                    const paddingFactor = 3.0;
                    const baseW = c.width || 300;
                    const baseH = c.height || 300;
                    const expandedW = baseW * paddingFactor;
                    const expandedH = baseH * paddingFactor;
                    const offsetX = (expandedW - baseW) / 2;
                    const offsetY = (expandedH - baseH) / 2;

                    const tileBuffer = await imageService.getTileImage(buffer, c.mime_type, {
                        x: Math.max(0, c.x - offsetX), 
                        y: Math.max(0, c.y - offsetY), 
                        width: expandedW, 
                        height: expandedH
                    });
                    logService.debug(`[DrawingSearch] Generated tile image for candidate ${i}: ${tileBuffer.length} bytes`);
                    
                    return {
                        id: c.id,
                        index: i,
                        buffer: tileBuffer,
                        mimeType: 'image/png',
                        similarity: (c.similarity && typeof c.similarity === 'number') ? c.similarity.toFixed(2) : '0.00'
                    };
                } catch (err) {
                    console.error(`[DrawingSearch] Failed to fetch tile image for candidate ${i}:`, err);
                    return null;
                }
            }));

            const validCandidates = candidateImages.filter(img => img !== null);
            logService.debug(`[DrawingSearch] Valid candidates for reranking: ${validCandidates.length}`);

            const prompt = `
あなたは熟練の図面検図エキスパートです。
ユーザーが選択した「クエリ画像（選択範囲）」と、DBから抽出された「候補画像」を比較してください。

画像構成:
- 1枚目の画像: ユーザーが検索した「クエリ画像」
- 2枚目以降: 比較対象の「候補画像」 (下記の判定対象リストの順番に対応)

判定対象リスト:
${validCandidates.map((c, i) => `候補[${i}]: ID=${c.id}, 送付画像インデックス=${i + 1} (2枚目以降の通番), 暫定ベクトル類似度=${c.similarity}`).join('\n')}

判定ルール:
1. スケール不問の全体比較: クエリ画像と候補画像で拡大・縮小（スケール）の差があっても、拡大縮小して重ね合わせた時に全体の構造や文字が完全に一致する場合は、90%〜100%のスコアを付与してください。
2. 完全一致の最優先: 細部、線、文字が「全く同じ図面データ」の一部であると視覚的に判断できる場合（細部まで完全に重なる場合）は、非常に高く評価してください。
3. 視覚的な比較: 幾何学的構造（線の接続、シンボル、角度）が非常に似ている場合は、その類似度に応じてスコアを付けてください。
4. 回転の許容: 90度/180度/270度の回転があっても同一構造なら一致とみなしてください。
5. 文字情報の重視: 寸法値や注記の内容が一致している場合、非常に高い一致率（85%以上）を付与してください。
6. ノイズの許容: タイルの切り出し位置のわずかなズレや、スケール感の微差、解像度の違いによる細部のボケは、構造が同じであれば不一致の理由としないでください。
6. 画像未送付への対応: システム上の制約により、ここにリストされていない候補は判定の対象外です。

出力形式 (必ず以下のJSONフォーマットのみで回答):
[
  { "id": "候補ID", "score": 一致率(0-100), "reason": "判定理由(日本語)" }
]
`;

            // Gemini への入力（マルチモーダル: クエリ画像 + 候補タイル画像）
            logService.debug(`[DrawingSearch] Sending ${validCandidates.length + 1} images to Gemini (1 query + ${validCandidates.length} candidates)`);
            
            const responseText = await aiService.generateText(
                prompt, 
                queryBuffer, 
                'image/png', 
                validCandidates.map(img => ({ 
                    buffer: img.buffer, 
                    mimeType: img.mimeType 
                }))
            );
            logService.debug(`[DrawingSearch] Gemini response received. Length: ${responseText?.length}`);
            
            let reranked = [];
            try {
                reranked = aiService.parseJsonResponse(responseText);
                logService.debug(`[DrawingSearch] Parsed reranking results count: ${reranked?.length}`);
                if (Array.isArray(reranked)) {
                    reranked.forEach(r => logService.debug(`[DrawingSearch] Candidate ${r.id}: score=${r.score}, reason=${r.reason}`));
                }
            } catch (err) {
                logService.debug(`[DrawingSearch] Parse Error: ${err.message}`);
                logService.debug(`[DrawingSearch] Raw Response: ${responseText}`);
            }

            return candidates.map(c => {
                // 配列でない場合の安全なハンドリング
                const match = (Array.isArray(reranked) && c.id) ? reranked.find(r => r.id === c.id) : null;

                // サムネイルURLを相対パスで生成 (ポート不一致回避のため)
                // Gemini 精査用と同じく、3倍の広さで表示する
                const paddingFactor = 3.0;
                const baseW = c.width || c.w || 300;
                const baseH = c.height || c.h || 300;
                const expandedW = baseW * paddingFactor;
                const expandedH = baseH * paddingFactor;
                const offsetX = (expandedW - baseW) / 2;
                const offsetY = (expandedH - baseH) / 2;
                
                const thumbX = Math.max(0, (c.x || 0) - offsetX);
                const thumbY = Math.max(0, (c.y || 0) - offsetY);
                const fileId = c.file_id || c.id; // file_id を優先、なければ id
                const thumbUrl = `/api/search/thumbnail/${fileId}?x=${thumbX}&y=${thumbY}&w=${expandedW}&h=${expandedH}`;
                logService.debug(`[DrawingSearch] Candidate ${fileId} thumbnailUrl (relative): ${thumbUrl}`);

                // 元の候補情報(c)をベースに、AIの判定結果(match)をマージする
                return {
                    ...c,     // 元の候補情報（id, quotation_id, storage_path, x, y等）を優先
                    thumbnailUrl: thumbUrl,
                    ai_score: match ? (Number(match.score) || 0) : 0,
                    ai_reason: match ? (match.reason || '解析完了') : '判定なし（AI精査エラー）'
                };
            }).filter(res => res.ai_score > 50) // 50%以下は除外
              .sort((a, b) => b.ai_score - a.ai_score);

        } catch (e) {
            console.error('[DrawingSearch] Reranking failed:', e);
            // 失敗時もフロントエンドでundefinedにならないよう、デフォルト値を付与して返す
            return candidates.map(c => ({
                ...c,
                ai_score: 0,
                ai_reason: '解析エラー（システム一時不具合）'
            }));
        }
    }

    /**
     * 過去の類似案件に基づくAI自動見積もり
     * @param {Buffer} queryBuffer 
     * @param {Array} similarResults リランキング済みの検索結果
     */
    async estimateAI(queryBuffer, similarResults) {
        try {
            const topScorers = similarResults.filter(r => r.ai_score > 60);
            const referenceIds = [...new Set(topScorers.map(r => r.quotation_id))].slice(0, 3);

            let referenceData = "参考データなし";
            if (referenceIds.length > 0) {
                const { data: references } = await supabaseAdmin
                    .from('quotations')
                    .select('id, company_name, quotation_items(name, processing_cost, material_cost, other_cost)')
                    .in('id', referenceIds);
                referenceData = JSON.stringify(references, null, 2);
            }

            const prompt = `
あなたは製造業の見積算出のエキスパートです。
添付された図面（またはその一部）に対し、過去の類似案件のデータを参考にして、今回の推奨見積額を算出してください。

過去の参考データ:
${referenceData}

算出ルール:
1. 構造の複雑さ、加工工程の類似性を考慮してください。
2. 「加工費」「材料費」「その他」の内訳を提示してください。
3. なぜその金額になったのか、根拠を論理的に日本語で説明してください。

回答形式 (JSONのみ):
{
  "recommendedPrice": { "processing": 5000, "material": 2000, "other": 500 },
  "confidence": 85,
  "basis": "理由のテキスト"
}
`;

            const responseText = await aiService.generateText(prompt, queryBuffer, 'image/png');
            return aiService.parseJsonResponse(responseText);
        } catch (e) {
            console.error('[DrawingSearch] AI Estimation failed:', e);
            throw e;
        }
    }
}

module.exports = new DrawingSearchService();
