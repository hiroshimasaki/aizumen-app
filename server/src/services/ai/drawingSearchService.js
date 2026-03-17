const imageService = require('./imageService');
const vectorService = require('./vectorService');
const hashService = require('./hashService');
const aiService = require('../aiService');
const logService = require('../logService');
const path = require('path');
const fs = require('fs');

/**
 * 検索デバッグ用ロガー
 */
function debugLog(message) {
    console.log(message);
    try {
        const logsDir = path.join(process.cwd(), 'logs');
        const debugFilePath = path.join(logsDir, 'search_debug.txt');
        if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
        fs.appendFileSync(debugFilePath, `[${new Date().toISOString()}] ${message}\n`);
    } catch (e) { /* ignore */ }
}

const { supabaseAdmin } = require('../../config/supabase');
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

            // 1.5 ページ全体のハッシュ(pHash)を生成・保存 & サムネイル保存
            const pageHash = await hashService.generateDHash(processedBuffer);
            await supabaseAdmin
                .from('quotation_files')
                .update({ page_hash: pageHash })
                .eq('id', fileId);

            // [新規追加] サムネイル画像を PNG として保存
            const thumbnailPath = `thumbnails/${fileId}.png`;
            const { error: thumbError } = await supabaseAdmin.storage
                .from('quotation-files')
                .upload(thumbnailPath, processedBuffer, {
                    contentType: 'image/png',
                    upsert: true
                });
            
            if (thumbError) {
                console.error(`[DrawingSearch] Failed to upload thumbnail for ${fileId}:`, thumbError);
            } else {
                console.log(`[DrawingSearch] Thumbnail saved for ${fileId}`);
            }

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
    async searchSimilarDrawing(tenantId, queryImageBuffer, fullPageImageBuffer = null, pdfFileBuffer = null, fileId = null) {
        try {
            debugLog(`[DrawingSearch] Starting hybrid search for tenant: ${tenantId}`);
            debugLog(`[DrawingSearch] Input params: hasPdfFile=${!!pdfFileBuffer}, fileId=${fileId}`);
            const searchStart = Date.now();

            // ============================================================
            // 0. pHash による同一図面の超高速特定 (第一層)
            //    優先度: pdfFile(元PDF) > fileId(DB参照) > fullPageImage(フォールバック)
            // ============================================================
            let queryPageHash = null;
            let pHashThreshold = 20; // デフォルト閾値

            if (pdfFileBuffer) {
                // 案C: 元PDFをサーバーで登録時と同一パイプラインで処理してdHash生成
                const hashStart = Date.now();
                const processedForHash = await imageService.preprocessImage(pdfFileBuffer, 'application/pdf');
                queryPageHash = await hashService.generateDHash(processedForHash);
                pHashThreshold = 15; // ハイブリッド候補として拾うための広めの閾値
                debugLog(`[SearchPerformance] pHash from PDF pipeline: ${Date.now() - hashStart}ms, hash: ${queryPageHash}, threshold: ${pHashThreshold}`);
            } else if (fileId) {
                // 案A: 既存ファイルのDB上のハッシュを直接参照
                const hashStart = Date.now();
                const { data: fileRecord } = await supabaseAdmin
                    .from('quotation_files')
                    .select('page_hash')
                    .eq('id', fileId)
                    .single();
                if (fileRecord?.page_hash) {
                    queryPageHash = fileRecord.page_hash;
                    pHashThreshold = 5; // DB上の同一ハッシュなら厳しめに
                    debugLog(`[SearchPerformance] pHash from DB (fileId): ${Date.now() - hashStart}ms, hash: ${queryPageHash}, threshold: ${pHashThreshold}`);
                } else {
                    debugLog(`[DrawingSearch] fileId ${fileId} has no page_hash in DB, skipping DB lookup`);
                }
            } else if (fullPageImageBuffer) {
                // フォールバック: クライアントからのフルページ画像でdHash生成（精度は低い）
                const hashStart = Date.now();
                queryPageHash = await hashService.generateDHash(fullPageImageBuffer);
                pHashThreshold = 25; // パイプライン差異を許容する非常に緩い閾値
                debugLog(`[SearchPerformance] pHash from fullPageImage (fallback): ${Date.now() - hashStart}ms, hash: ${queryPageHash}, threshold: ${pHashThreshold}`);
            }

            let pHashCandidates = []; // Geminiに渡すための候補

            if (queryPageHash) {
                const matchStart = Date.now();
                // 修正: 'match_drawing_by_hash' は file_type フィルタがある可能性があるため、
                // もしヒットしない場合は距離優先で attachment も含めて再検索するロジックを検討
                let { data: matches } = await supabaseAdmin.rpc('match_drawing_by_hash', {
                    p_query_hash: queryPageHash,
                    p_tenant_id: tenantId,
                    p_threshold: pHashThreshold
                });
                const hashMs = Date.now() - matchStart;
                debugLog(`[SearchPerformance] pHash DB Match (RPC): ${hashMs}ms, hits: ${matches?.length || 0}`);
                
                // [DEBUG] もしRPCで 0 件なら、直接テーブルを叩いて attachment も含めて確認
                if (!matches || matches.length === 0) {
                    debugLog(`[DrawingSearch] RPC returned 0 hits. Checking quotation_files table directly...`);
                    const { data: allHashes } = await supabaseAdmin
                        .from('quotation_files')
                        .select('id, page_hash, original_name, quotation_id, storage_path, mime_type, file_type')
                        .eq('tenant_id', tenantId)
                        .not('page_hash', 'is', null);
                    
                    if (allHashes) {
                        const directMatches = allHashes.map(f => ({
                            file_id: f.id,
                            hamming_distance: hashService.calculateHammingDistance(queryPageHash, f.page_hash),
                            file: f
                        })).filter(m => m.hamming_distance <= pHashThreshold)
                          .sort((a,b) => a.hamming_distance - b.hamming_distance);

                        if (directMatches.length > 0) {
                            debugLog(`[DrawingSearch] Found ${directMatches.length} matches by direct scan. Best dist: ${directMatches[0].hamming_distance}`);
                            matches = directMatches.map(m => ({
                                file_id: m.file_id,
                                hamming_distance: m.hamming_distance
                            }));
                        }
                    }
                }

                if (matches && matches.length > 0) {
                    matches.forEach(m => debugLog(`  [pHash] file: ${m.file_id.substring(0,8)}... hamming: ${m.hamming_distance}`));
                }

                // 自分自身を除外（fileIdがある場合）
                const filteredMatches = fileId
                    ? matches?.filter(m => m.file_id !== fileId)
                    : matches;

                // --- 新ロジック: 高速パス判定 (距離が極めて近い場合のみ) ---
                const fastPathMatches = filteredMatches?.filter(m => m.hamming_distance <= 2);

                if (fastPathMatches && fastPathMatches.length > 0) {
                    debugLog(`[DrawingSearch] ★ pHash FAST PATH (dist <= 2): ${fastPathMatches.length} file(s). Skipping Gemini.`);
                    
                    const matchFileIds = fastPathMatches.map(m => m.file_id);
                    const { data: matchFiles } = await supabaseAdmin
                        .from('quotation_files')
                        .select('id, storage_path, mime_type, original_name, quotation_id')
                        .in('id', matchFileIds);

                    const fastResults = fastPathMatches.map(m => {
                        const file = matchFiles?.find(f => f.id === m.file_id);
                        const fid = m.file_id;
                        return {
                            file_id: fid,
                            quotation_id: file?.quotation_id,
                            storage_path: file?.storage_path,
                            mime_type: file?.mime_type,
                            original_name: file?.original_name,
                            thumbnailUrl: `/api/search/thumbnail/${fid}?x=0.25&y=0.25&w=0.5&h=0.5`, // 中央 50% を表示 (広範囲)
                            ai_score: m.hamming_distance === 0 ? 100 : 98,
                            ai_reason: `pHash一致 (距離: ${m.hamming_distance}) - 同一図面と高度に推定されます`
                        };
                    });
                    debugLog(`[SearchPerformance] Total (FAST PATH): ${Date.now() - searchStart}ms`);
                    return fastResults;
                }

                // 高速パスではないが候補として Gemini 送り
                if (filteredMatches && filteredMatches.length > 0) {
                    debugLog(`[DrawingSearch] pHash found ${filteredMatches.length} loose matches (dist > 2). Adding to candidates.`);
                    const matchFileIds = filteredMatches.map(m => m.file_id);
                    const { data: matchFiles } = await supabaseAdmin
                        .from('quotation_files')
                        .select('id, storage_path, mime_type, original_name, quotation_id')
                        .in('id', matchFileIds);

                    pHashCandidates = filteredMatches.map(m => {
                        const file = matchFiles?.find(f => f.id === m.file_id);
                        return {
                            id: m.file_id,
                            file_id: m.file_id,
                            quotation_id: file?.quotation_id,
                            storage_path: file?.storage_path,
                            mime_type: file?.mime_type,
                            original_name: file?.original_name,
                            pHashDistance: m.hamming_distance,
                            similarity: 1.0 // 優先度上げ
                        };
                    });
                }
            }

            // ============================================================
            // 1. ベクトル検索 (第二層) — pHash で見つからなかった場合のみ実行
            // ============================================================
            const vecStart = Date.now();
            const processedQuery = await imageService.preprocessImage(queryImageBuffer);
            const queryEmbedding = await vectorService.getEmbedding(processedQuery);

            const { data: rawCandidates, error: matchError } = await supabaseAdmin.rpc('match_drawing_tiles', {
                query_embedding: queryEmbedding,
                match_threshold: 0.05,
                match_count: 50, // 100→50に削減（名寄せ後5件しか使わないため十分）
                p_tenant_id: tenantId
            });
            console.log(`[SearchPerformance] Vector Search: ${Date.now() - vecStart}ms, hits: ${rawCandidates?.length || 0}`);

            if (matchError) throw matchError;

            if (!rawCandidates || rawCandidates.length === 0) {
                console.log(`[DrawingSearch] No candidates found for tenant: ${tenantId}`);
                return [];
            }

            // ============================================================
            // 2. 名寄せ（デデュプリケーション）
            // ============================================================
            const fileMap = new Map();
            for (const c of rawCandidates) {
                if (!fileMap.has(c.file_id) || c.similarity > fileMap.get(c.file_id).similarity) {
                    fileMap.set(c.file_id, { ...c, is_hash_match: false });
                }
            }

            const sortedUniqueCandidates = Array.from(fileMap.values())
                .sort((a, b) => b.similarity - a.similarity);

            console.log(`[DrawingSearch] Unique files: ${sortedUniqueCandidates.length}`);
            sortedUniqueCandidates.slice(0, 10).forEach((c, i) => {
                console.log(`  [Rank ${i}] ${c.file_id.substring(0,8)}... sim: ${c.similarity.toFixed(4)}`);
            });

            // Gemini 候補を 10件 に選定
            const uniqueFileCandidates = sortedUniqueCandidates.slice(0, 10);

            // [Optimization] pHash候補を先頭にマージ (重複排除)
            let combinedCandidates = [...pHashCandidates];
            uniqueFileCandidates.forEach(c => {
                if (!combinedCandidates.find(pc => pc.id === c.file_id)) {
                    combinedCandidates.push({
                        ...c,
                        id: c.file_id // id統一
                    });
                }
            });

            // 最終的にGeminiに送る数を制限
            const finalGeminiCandidates = combinedCandidates.slice(0, 10);
            debugLog(`[DrawingSearch] Total candidates for Gemini: ${finalGeminiCandidates.length} (pHash: ${pHashCandidates.length}, Vector: ${uniqueFileCandidates.length})`);

            // ============================================================
            // 3. ファイル情報の補填
            // ============================================================
            const fileIds = [...new Set(finalGeminiCandidates.map(c => c.id))];
            const { data: files } = await supabaseAdmin
                .from('quotation_files')
                .select('id, storage_path, mime_type, original_name')
                .in('id', fileIds);
            
            const enhancedCandidates = finalGeminiCandidates.map(c => {
                const file = files?.find(f => f.id === c.id);
                return {
                    ...c,
                    storage_path: file?.storage_path,
                    mime_type: file?.mime_type,
                    original_name: file?.original_name
                };
            });

            // ============================================================
            // 4. Gemini による二次精査（リランキング）
            // ============================================================
            const geminiStart = Date.now();
            const rerankedResults = await this.rerankWithGemini(queryImageBuffer, enhancedCandidates);
            console.log(`[SearchPerformance] Gemini Reranking: ${Date.now() - geminiStart}ms`);
            console.log(`[SearchPerformance] Total Search: ${Date.now() - searchStart}ms`);

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
            const dlStart = Date.now();
            // [戦略3] 同一ファイルのダウンロードをキャッシュで重複排除
            const fileDownloadCache = new Map();
            const candidateImages = await Promise.all(candidates.slice(0, 10).map(async (c, i) => {
                try {
                    if (!c.storage_path) return null;
                    
                    // キャッシュにあればそちらを使う
                    let buffer;
                    if (fileDownloadCache.has(c.storage_path)) {
                        buffer = fileDownloadCache.get(c.storage_path);
                    } else {
                        const { data: fileData } = await supabaseAdmin.storage
                            .from('quotation-files')
                            .download(c.storage_path);
                        if (!fileData) return null;
                        buffer = Buffer.from(await fileData.arrayBuffer());
                        fileDownloadCache.set(c.storage_path, buffer);
                    }
                    
                    // [精度改善] paddingFactor を 2.0 -> 8.0 に大幅拡大 (コンテキスト不足解消)
                    const paddingFactor = 8.0;
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
                    console.error(`[DrawingSearch] Failed to fetch tile image for candidate ${i}:`, err.message);
                    return null;
                }
            }));

            const validCandidates = candidateImages.filter(img => img !== null);
            console.log(`[SearchPerformance] Download & Crop: ${Date.now() - dlStart}ms (${validCandidates.length} images)`);
            
            if (validCandidates.length === 0) {
                console.log('[DrawingSearch] No valid candidate images. Returning vector-based fallback.');
                return this._buildFallbackResults(candidates);
            }

            const apiStart = Date.now();
            const prompt = `
あなたは熟練の図面検図エキスパートです。
ユーザーが選択した「クエリ画像（部品の一部・拡大）」が、提示された「候補図面」の中に含まれているか、形状が一致するかを判定してください。

判定対象リスト:
${validCandidates.map((c, i) => `候補[${i}]: ID=${c.id}, 送付画像インデックス=${i + 1} (2枚目以降の通番), 暫定ベクトル類似度=${c.similarity}`).join('\n')}

判定基準:
1. 幾何学的構造の完全一致 (最優先): 線の接続、部品のシルエット、孔の数、配置、角度が実質的に同一であるか。
2. スケール不問の比較: クエリは拡大されている可能性があります。相対的な構造が一致していれば、絶対的な大きさの違いは無視してください。
3. 候補図面のコンテキスト利用: 候補画像はクエリ周辺を広く写しています。クエリの部品が候補画像内のどこかに「同一形状」として存在するか探してください。
4. 文字情報の一致: 寸法値や加工指示（M8, φ50等）が読み取れる場合、それらの一致を強く考慮してください。
5. 厳格な評価: 形状が明らかに異なる（例：穴の数が違う、角のRが違う）場合は、類似していてもスコアを低く（40%以下）してください。

スコア定義:
- 90-100%: 同一または、ほぼ同一の設計。
- 70-89%: 形状や寸法が非常に似ているが、細部に僅かな差がある。
- 40-69%: 構造の一部が類似しているが、全体としては別物。
- 0-39%: 構造が大きく異なる。

出力形式 (JSONのみ):
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
            debugLog(`[SearchPerformance] Gemini API: ${Date.now() - apiStart}ms`);
            
            // [DEBUG] Gemini応答内容をログ出力
            debugLog(`[DrawingSearch] Gemini raw response (first 500 chars): ${responseText?.substring(0, 500)}`);
            
            let reranked = [];
            const logsDir = path.join(process.cwd(), 'logs');
            const debugFilePath = path.join(logsDir, 'search_debug.txt');
            
            try {
                // ディレクトリ存在チェック
                if (!fs.existsSync(logsDir)) {
                    fs.mkdirSync(logsDir, { recursive: true });
                }

                reranked = aiService.parseJsonResponse(responseText);
                debugLog(`[DrawingSearch] Gemini reranked ${reranked?.length || 0} candidates.`);
                
                // [Optimization] pHash一致のものをGemini結果がない場合に補遺、またはスコアを最高値に固定
                candidates.forEach(c => {
                    if (c.is_hash_match) {
                        const existing = reranked.find(r => r.id === c.file_id);
                        if (existing) {
                            existing.score = 100; // pHash一致は無条件で 100点
                            existing.reason = `[pHash Match] ${existing.reason}`;
                        } else {
                            reranked.push({ id: c.file_id, score: 100, reason: "完全一致 (pHash検出)" });
                        }
                    }
                });
                
                // 強制的にファイルへ書き出し
                const debugLog = `[${new Date().toISOString()}] Gemini Response:\n${responseText}\nParsed: ${JSON.stringify(reranked)}\n---\n`;
                fs.appendFileSync(debugFilePath, debugLog);
                
            } catch (err) {
                console.error(`[DrawingSearch] Gemini Parse Error: ${err.message}`);
                try {
                    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
                    fs.appendFileSync(debugFilePath, `[${new Date().toISOString()}] Parse Error: ${err.message}\nRaw: ${responseText}\n`);
                } catch (e) { /* ignore log error */ }
            }

            // [FIX] Gemini結果が空の場合、ベクトル類似度ベースのフォールバックを使用
            if (!Array.isArray(reranked) || reranked.length === 0) {
                console.warn('[DrawingSearch] Gemini returned no results. Using vector similarity fallback.');
                return this._buildFallbackResults(candidates);
            }

            const finalResults = candidates.map(c => {
                const fid = c.file_id || c.id;
                const match = reranked.find(r => r.id === fid);
                
                const paddingFactor = 5.0; // 3.0 -> 5.0 にさらに拡大 (広範囲・縮小表示)
                const baseW = c.width || 0.2;
                const baseH = c.height || 0.2;
                const centerX = (c.x !== undefined) ? (c.x + baseW / 2) : 0.5;
                const centerY = (c.y !== undefined) ? (c.y + baseH / 2) : 0.5;
                
                const thumbW = Math.min(1.0, baseW * paddingFactor);
                const thumbH = Math.min(1.0, baseH * paddingFactor);
                const thumbX = Math.max(0, Math.min(1.0 - thumbW, centerX - thumbW / 2));
                const thumbY = Math.max(0, Math.min(1.0 - thumbH, centerY - thumbH / 2));
                const thumbUrl = `/api/search/thumbnail/${fid}?x=${thumbX}&y=${thumbY}&w=${thumbW}&h=${thumbH}`;

                // Gemini結果が存在する場合：マッチしないものはスコア0（Geminiによる拒否）
                // Gemini結果が空（エラー/フォールバック）の場合：ベクトル類似度を使用
                const vectorScore = Math.round((c.similarity || 0) * 100);
                let aiScore = 0;
                let aiReason = `ベクトル類似度: ${(c.similarity || 0).toFixed(2)}`;

                if (Array.isArray(reranked) && reranked.length > 0) {
                    if (match) {
                        aiScore = Number(match.score) || 0;
                        aiReason = match.reason || '解析完了';
                    } else {
                        // Geminiが他を選んだ（この候補は拒絶された）場合
                        aiScore = 0;
                        aiReason = 'Geminiによる形状不一致判定';
                    }
                } else {
                    // Geminiが動作しなかった場合のフォールバック
                    aiScore = vectorScore;
                }

                return {
                    ...c,
                    thumbnailUrl: thumbUrl,
                    ai_score: aiScore,
                    ai_reason: aiReason
                };
            }).filter(res => res.ai_score >= 15)
              .sort((a, b) => b.ai_score - a.ai_score);

            console.log(`[DrawingSearch] Final results after filtering: ${finalResults.length}`);
            return finalResults;

        } catch (e) {
            console.error('[DrawingSearch] Reranking failed:', e);
            // エラー時も結果を返す
            return this._buildFallbackResults(candidates);
        }
    }

    /**
     * ベクトル類似度ベースのフォールバック結果を生成
     */
    _buildFallbackResults(candidates) {
        return candidates.map(c => {
            const fid = c.file_id || c.id;
            const paddingFactor = 2.0;
            const baseW = c.width || 300;
            const baseH = c.height || 300;
            const thumbX = Math.max(0, (c.x || 0) - (baseW * (paddingFactor - 1) / 2));
            const thumbY = Math.max(0, (c.y || 0) - (baseH * (paddingFactor - 1) / 2));
            const thumbUrl = `/api/search/thumbnail/${fid}?x=${thumbX}&y=${thumbY}&w=${baseW * paddingFactor}&h=${baseH * paddingFactor}`;
            return {
                ...c,
                thumbnailUrl: thumbUrl,
                ai_score: Math.round((c.similarity || 0) * 100),
                ai_reason: `ベクトル類似度: ${(c.similarity || 0).toFixed(2)} (AI判定スキップ)`
            };
        }).filter(res => res.ai_score >= 15)
          .sort((a, b) => b.ai_score - a.ai_score);
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
