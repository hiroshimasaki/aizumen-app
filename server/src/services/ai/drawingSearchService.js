const imageService = require('./imageService');
const vectorService = require('./vectorService');
const { supabaseAdmin } = require('../../config/supabase');
const aiService = require('../aiService');
const logService = require('../logService');
const systemLimits = require('../../config/systemLimits');

class DrawingSearchService {
    /**
     * 図面の登録（インデックス作成）
     */
    async registerDrawing(quotationId, fileId, tenantId, fileBuffer, mimeType = 'application/pdf') {
        try {
            console.log(`[DrawingSearch] Indexing drawing for quotation: ${quotationId} (${mimeType})`);

            // 1. 前処理
            const processedBuffer = await imageService.preprocessImage(fileBuffer, mimeType);

            // 2. タイル分割
            let tiles = await imageService.tileImage(processedBuffer);
            
            // [Optimization] タイル数上限チェック
            if (tiles.length > systemLimits.MAX_TILES_PER_DRAWING) {
                console.log(`[DrawingSearch] Clipping tiles from ${tiles.length} to ${systemLimits.MAX_TILES_PER_DRAWING}`);
                tiles = tiles.slice(0, systemLimits.MAX_TILES_PER_DRAWING);
            }
            
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

            // Supabaseへ小分けに保存（大量データによるタイムアウト防止）
            const chunkSize = 50;
            for (let i = 0; i < insertData.length; i += chunkSize) {
                const chunk = insertData.slice(i, i + chunkSize);
                const { error } = await supabaseAdmin
                    .from('drawing_tiles')
                    .insert(chunk);
                if (error) throw error;
            }

            console.log(`[DrawingSearch] Successfully indexed ${tiles.length} tiles for ${fileId}`);
        } catch (error) {
            console.error('[DrawingSearch] Registration failed:', error);
            throw error;
        }
    }

    /**
     * 類似図面の検索
     */
    async searchSimilarDrawing(tenantId, queryImageBuffer) {
        try {
            // 1. クエリ画像の特徴量生成
            console.time('[SearchPerformance] Preprocess & Embedding');
            const processedQuery = await imageService.preprocessImage(queryImageBuffer);
            const queryEmbedding = await vectorService.getEmbedding(processedQuery);
            console.timeEnd('[SearchPerformance] Preprocess & Embedding');

            // 2. pgvector を使用した一次検索
            console.time('[SearchPerformance] Vector Search (RPC)');
            const { data: candidates, error } = await supabaseAdmin.rpc('match_drawing_tiles', {
                query_embedding: queryEmbedding,
                match_threshold: 0.3,
                match_count: 80,
                p_tenant_id: tenantId
            });
            console.timeEnd('[SearchPerformance] Vector Search (RPC)');

            if (error) throw error;

            if (!candidates || candidates.length === 0) {
                console.log(`[DrawingSearch] No candidates found in vector search for tenant: ${tenantId}`);
                return [];
            }
            console.log(`[DrawingSearch] Found ${candidates.length} candidates in vector search.`);

            // 2.5 名寄せ（デデュプリケーション）
            const uniqueFileCandidates = [];
            const seenFileIds = new Set();
            for (const c of candidates) {
                if (!seenFileIds.has(c.file_id)) {
                    uniqueFileCandidates.push(c);
                    seenFileIds.add(c.file_id);
                    if (uniqueFileCandidates.length >= 20) break;
                }
            }

            // 2.6 ファイル情報の補填
            const fileIds = [...new Set(uniqueFileCandidates.map(c => c.file_id))];
            const { data: files } = await supabaseAdmin
                .from('quotation_files')
                .select('id, storage_path, mime_type, original_name')
                .in('id', fileIds);
            
            const enhancedCandidates = uniqueFileCandidates.map(c => {
                const file = files?.find(f => f.id === c.file_id);
                return {
                    ...c,
                    storage_path: file?.storage_path,
                    mime_type: file?.mime_type,
                    original_name: file?.original_name
                };
            });

            // 3. Gemini による二次精査（リランキング）
            console.time('[SearchPerformance] Gemini Reranking');
            const rerankedResults = await this.rerankWithGemini(queryImageBuffer, enhancedCandidates);
            console.timeEnd('[SearchPerformance] Gemini Reranking');

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
            console.time('[SearchPerformance]   Download & Crop Candidates');
            const candidateImages = await Promise.all(candidates.slice(0, 20).map(async (c, i) => {
                try {
                    if (!c.storage_path) return null;
                    const { data: fileData } = await supabaseAdmin.storage
                        .from('quotation-files')
                        .download(c.storage_path);
                    if (!fileData) return null;

                    const buffer = Buffer.from(await fileData.arrayBuffer());
                    
                    // Gemini 処理用に、より広い範囲（元のタイルサイズの 3倍）を切り出す
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
                    
                    return {
                        id: c.file_id || c.id,
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
            console.timeEnd('[SearchPerformance]   Download & Crop Candidates');
            
            if (validCandidates.length === 0) return candidates; // 画像取得不可なら一次検索結果を返す

            console.time('[SearchPerformance]   Gemini API Request');
            const prompt = `
あなたは熟練の図面検図エキスパートです。
ユーザーが選択した「クエリ画像（選択範囲）」と、DBから抽出された「候補画像」を比較してください。

判定対象リスト:
${validCandidates.map((c, i) => `候補[${i}]: ID=${c.id}, 送付画像インデックス=${i + 1} (2枚目以降の通番), 暫定ベクトル類似度=${c.similarity}`).join('\n')}

判定基準 (厳格に適用してください):
1. 幾何学的構造の完全一致 (最優先): 線の接続、部品のシルエット、孔の数や配置、角度が実質的に同一である場合のみ、高い一致率（80%以上）を検討してください。構造が異なる場合は、文字が似ていても40%以下に抑えてください。
2. スケール不問の全体比較: 図面内の相対的な位置関係や構造が一致していれば、画像上の大きさの違いは無視してください。
3. 文字情報の一致: 寸法値（例: φ50, 30°, M8等）や公差、加工指示文字が一致している場合、さらに加点してください。
4. 回転・反転の許容: 90度/180度/270度の回転や、ミラー反転による見た目の違いは、論理的に同一構造であれば一致と見なしてください。
5. スコアの定義:
   - 90-100%: ほぼ同一または完全に同等な設計。
   - 70-89%: 形状や寸法が非常に似ているが、細部に僅かな差がある。
   - 40-69%: 部分的に類似した構造を持つが、全体としては別の図面。
   - 0-39%: 明らかに異なる構造。
6. 厳格な評価: ユーザーは正確な結果を求めています。「なんとなく似ている」程度で90%以上の高得点を付けないでください。

出力形式 (必ず以下のJSONフォーマットのみで回答):
[
  { "id": "候補ID", "score": 一致率(0-100), "reason": "判定理由(日本語)" }
]
`;

            let responseText = await aiService.generateText(
                prompt, 
                queryBuffer, 
                'image/png', 
                validCandidates.map(img => ({ buffer: img.buffer, mimeType: img.mimeType }))
            );
            console.timeEnd('[SearchPerformance]   Gemini API Request');
            
            let reranked = [];
            try {
                reranked = aiService.parseJsonResponse(responseText);
            } catch (err) {
                console.error(`[DrawingSearch] Parse Error: ${err.message}`, responseText);
            }

            return candidates.map(c => {
                const fid = c.file_id || c.id;
                const match = (Array.isArray(reranked)) ? reranked.find(r => r.id === fid) : null;
                
                const paddingFactor = 3.0;
                const baseW = c.width || 300;
                const baseH = c.height || 300;
                const thumbX = Math.max(0, (c.x || 0) - (baseW * (paddingFactor - 1) / 2));
                const thumbY = Math.max(0, (c.y || 0) - (baseH * (paddingFactor - 1) / 2));
                const thumbUrl = `/api/search/thumbnail/${fid}?x=${thumbX}&y=${thumbY}&w=${baseW * paddingFactor}&h=${baseH * paddingFactor}`;

                return {
                    ...c,
                    thumbnailUrl: thumbUrl,
                    ai_score: match ? (Number(match.score) || 0) : 0,
                    ai_reason: match ? (match.reason || '解析完了') : '判定なし'
                };
            }).filter(res => res.ai_score >= 25)
              .sort((a, b) => b.ai_score - a.ai_score);

        } catch (e) {
            console.error('[DrawingSearch] Reranking failed:', e);
            return candidates;
        }
    }

    /**
     * 見積もりAI
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
あなたは見積算出のエキスパートです。過去の類似案件を参考に推奨見積額を算出してください。
参考データ: ${referenceData}
回答形式 (JSONのみ): { "recommendedPrice": { "processing": 0, "material": 0, "other": 0 }, "basis": "理由" }
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
