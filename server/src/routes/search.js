const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authMiddleware } = require('../middleware/auth');
const drawingSearchService = require('../services/ai/drawingSearchService');
const imageService = require('../services/ai/imageService'); // Added
const { supabaseAdmin } = require('../config/supabase'); // Added
const { AppError } = require('../middleware/errorHandler');

const { checkCredits } = require('../middleware/credits');
const creditService = require('../services/creditService');

const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/search/similar
 * 矩形選択範囲の画像を用いた類似図面検索
 */
router.post('/similar', authMiddleware, checkCredits(1), upload.fields([{ name: 'queryImage' }, { name: 'fullPageImage' }]), async (req, res, next) => {
    try {
        const queryFile = req.files['queryImage']?.[0];
        const fullPageFile = req.files['fullPageImage']?.[0];

        if (!queryFile) {
            throw new AppError('検索クエリ画像が必要です', 400, 'NO_QUERY_IMAGE');
        }

        const amount = 1;
        console.log(`[Search] Similar search request from tenant: ${req.tenantId}`);

        const results = await drawingSearchService.searchSimilarDrawing(
            req.tenantId,
            queryFile.buffer,
            fullPageFile ? fullPageFile.buffer : null
        );

        // クレジット消費処理
        const creditResult = await creditService.consumeCredits(
            req.tenantId,
            req.user.id,
            amount,
            `類似図面検索 (矩形選択)`
        );

        res.json({
            success: true,
            results: results,
            creditStats: {
                cost: amount,
                remainingBalance: creditResult.balance,
                purchasedBalance: creditResult.purchased_balance
            }
        });
    } catch (error) {
        console.error('[Search API] Error:', error);
        res.status(500).json({ error: 'Search failed' }); // Modified
    }
});

/**
 * GET /api/search/thumbnail/:fileId
 * 特定の図面ファイルから指定範囲を切り出して返す
 */
router.get('/thumbnail/:fileId', authMiddleware, async (req, res) => {
    try {
        const { fileId } = req.params;
        const { x, y, w, h } = req.query;

        console.log(`[SearchAPI] Received thumbnail request for fileId: ${fileId}, query:`, req.query);

        if (!x || !y || !w || !h) {
            return res.status(400).json({ error: 'Coordinates (x, y, w, h) are required' });
        }

        // 1. ファイルのメタデータとパスを取得
        const { data: fileMeta, error: metaErr } = await supabaseAdmin
            .from('quotation_files')
            .select('storage_path, mime_type')
            .eq('id', fileId)
            // .eq('tenant_id', req.tenantId) // テナントチェックを有効にする場合はここを解除
            .single();

        if (metaErr || !fileMeta) {
            return res.status(404).json({ error: 'File not found' });
        }

        // 2. Storage からファイルをダウンロード
        const { data: fileData, error: dlErr } = await supabaseAdmin.storage
            .from('quotation-files')
            .download(fileMeta.storage_path);

        if (dlErr || !fileData) {
            console.error('[Search] Download error:', dlErr);
            return res.status(500).json({ error: 'Failed to download file' });
        }

        const buffer = Buffer.from(await fileData.arrayBuffer());

        // 3. 画像切り出し実行
        // 座標を数値に変換して渡す
        const croppedBuffer = await imageService.getTileImage(buffer, fileMeta.mime_type, {
            x: parseFloat(x),
            y: parseFloat(y),
            width: parseFloat(w),
            height: parseFloat(h)
        });

        // 4. レスポンス
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=3600'); // 1時間キャッシュ
        res.send(croppedBuffer);

    } catch (err) {
        console.error('[Search] Thumbnail generation failed:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
