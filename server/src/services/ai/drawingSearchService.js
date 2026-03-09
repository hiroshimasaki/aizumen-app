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
                match_threshold: 0.4, // 0.3から0.4に引き上げ、より厳密な判定にする
                match_count: 5,
                p_tenant_id: tenantId
            });

            if (error) throw error;

            if (!candidates || candidates.length === 0) {
                console.log('[DrawingSearch] No candidates found in vector search.');
                return [];
            }

            // 2.5 storage_path / mime_type の補填（RPCのレスポンス不整合対策）
            const fileIds = [...new Set(candidates.map(c => c.file_id))];
            const { data: files } = await supabaseAdmin
                .from('quotation_files')
                .select('id, storage_path, mime_type')
                .in('id', fileIds);
            
            const enhancedCandidates = candidates.map(c => {
                const file = files?.find(f => f.id === c.file_id);
                return {
                    ...c,
                    storage_path: c.storage_path || file?.storage_path,
                    mime_type: c.mime_type || file?.mime_type
                };
            });

            // 3. Gemini による二次精査（リランキング）
            const rerankedResults = await this.rerankWithGemini(queryImageBuffer, enhancedCandidates);

            // サムネイルURLを付与（新設するAPIエンドポイントに向ける）
            const resultsWithThumbnails = rerankedResults.map((res) => {
                if (!res.file_id) return res;
                
                // 座標情報を含めたサムネイルAPIのURLを生成
                const params = new URLSearchParams({
                    x: res.x,
                    y: res.y,
                    w: res.width,
                    h: res.height
                });
                return {
                    ...res,
                    thumbnailUrl: `${process.env.API_URL || ''}/api/search/thumbnail/${res.file_id}?${params.toString()}`
                };
            });

            return resultsWithThumbnails;
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
            // 各候補のタイル画像をバイナリデータとして取得
            const candidateImages = await Promise.all(candidates.slice(0, 3).map(async (c, i) => {
                try {
                    if (!c.storage_path) return null;
                    const { data: fileData } = await supabaseAdmin.storage
                        .from('quotation-files')
                        .download(c.storage_path);
                    if (!fileData) return null;

                    const buffer = Buffer.from(await fileData.arrayBuffer());
                    logService.debug(`[DrawingSearch] Fetched candidate ${i} from storage: ${buffer.length} bytes`);
                    const tileBuffer = await imageService.getTileImage(buffer, c.mime_type, {
                        x: c.x, 
                        y: c.y, 
                        width: c.width || 300, 
                        height: c.height || 300
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
1. 視覚的な比較: 送信された画像を直接見て、クエリ画像と幾何学的構造（線の接続、シンボル、角度）が一致しているか判定してください。
2. 回転の許容: 90度/180度の回転があっても同一構造なら一致とみなしてください。
3. 文字情報の優先: 寸法値や注記が読み取れる場合、それらの一致を高く評価してください。
4. 画像未送付への対応: システム上の制約により、ここにリストされていない候補は判定の対象外です。

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
            
            logService.debug(`[DrawingSearch] Parsed reranking results count: ${reranked?.length}`);
            if (Array.isArray(reranked)) {
                reranked.forEach(r => logService.debug(`[DrawingSearch] Candidate ${r.id}: score=${r.score}, reason=${r.reason}`));
            }

            return candidates.map(c => {
                // 配列でない場合の安全なハンドリング
                const match = (Array.isArray(reranked) && c.id) ? reranked.find(r => r.id === c.id) : null;

                // 元の候補情報(c)をベースに、AIの判定結果(match)をマージする
                // 以前は ...match, ...c の順だったため、もし match に null や古い ID が入ると上書きされる懸念があった
                return {
                    ...c,     // 元の候補情報（id, quotation_id, storage_path, x, y等）を優先
                    ai_score: match ? (Number(match.score) || 0) : 0,
                    ai_reason: match ? (match.reason || '解析完了') : '判定なし（AI精査エラー）'
                };
            }).sort((a, b) => b.ai_score - a.ai_score);

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
