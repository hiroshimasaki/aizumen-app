const imageService = require('./imageService');
const vectorService = require('./vectorService');
const { supabaseAdmin } = require('../../config/supabase');
const aiService = require('../aiService'); // 既存のVertex AI / Gemini設定を利用

class DrawingSearchService {
    /**
     * 図面の登録（インデックス作成）
     * @param {string} quotationId 
     * @param {string} fileId 
     * @param {string} tenantId 
     * @param {Buffer} fileBuffer 
     */
    async registerDrawing(quotationId, fileId, tenantId, fileBuffer) {
        try {
            console.log(`[DrawingSearch] Indexing drawing for quotation: ${quotationId}`);

            // 1. 前処理
            const processedBuffer = await imageService.preprocessImage(fileBuffer);

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
            console.log(`[DrawingSearch] Vector search returned ${candidates?.length || 0} candidates with threshold 0.3.`);

            if (!candidates || candidates.length === 0) {
                console.log('[DrawingSearch] No candidates found in vector search.');
                return [];
            }

            // 3. Gemini による二次精査（リランキング）
            const rerankedResults = await this.rerankWithGemini(queryImageBuffer, candidates);

            // サムネイルURLを付与（候補箇所の切り出し画像をフロントエンドで表示するため）
            const resultsWithThumbnails = await Promise.all(rerankedResults.map(async (res) => {
                try {
                    // Supabase Storage から署名付きURLを取得
                    const { data: signedUrl } = await supabaseAdmin.storage
                        .from('quotation-files')
                        .createSignedUrl(res.storage_path, 3600); // 1時間有効

                    return {
                        ...res,
                        thumbnailUrl: signedUrl?.signedUrl || null
                    };
                } catch (err) {
                    console.error('[DrawingSearch] Failed to generate thumbnail URL:', err);
                    return res;
                }
            }));

            console.log(`[DrawingSearch] Reranking completed. Top score: ${resultsWithThumbnails[0]?.ai_score || 0}`);
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
            const prompt = `
あなたは熟練の図面検図エキスパートです。
添付された「クエリ画像（選択範囲）」と、提示された「候補情報」を幾何学的に比較してください。

候補リスト:
${candidates.map((c, i) => `候補[${i}]: ID=${c.id}, 暫定類似度=${(c.similarity && typeof c.similarity === 'number') ? c.similarity.toFixed(2) : '0.00'}, 見積ID=${c.quotation_id}`).join('\n')}

判定ルール:
1. ノイズ（掠れ、黒点）は無視し、図形の幾何学的構造（線の接続、角度、シンボル）のみを比較してください。
2. 90度/180度の回転があっても、構造が同じなら同一とみなしてください。
3. 各候補に対してスコア(0-100)と、その判定理由を端的に日本語で回答してください。

出力形式 (JSONのみ):
[
  { "id": "候補ID", "score": 95, "reason": "理由" }
]
`;

            const responseText = await aiService.generateText(prompt, queryBuffer, 'image/png');
            console.log(`[DrawingSearch] Gemini response for reranking: ${responseText}`);
            const reranked = aiService.parseJsonResponse(responseText);

            return candidates.map(c => {
                // 配列でない場合の安全なハンドリング
                const match = (Array.isArray(reranked) && c.id) ? reranked.find(r => r.id === c.id) : null;
                return {
                    ...match, // score, reason 等（Geminiの返却値）
                    ...c,     // 元の候補情報（id, quotation_id, storage_path, x, y等）
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
