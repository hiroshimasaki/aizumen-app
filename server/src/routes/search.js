const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authMiddleware } = require('../middleware/auth');
const drawingSearchService = require('../services/ai/drawingSearchService');
const { AppError } = require('../middleware/errorHandler');

const { checkCredits } = require('../middleware/credits');
const creditService = require('../services/creditService');

const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/search/similar
 * 矩形選択範囲の画像を用いた類似図面検索
 */
router.post('/similar', authMiddleware, checkCredits(1), upload.single('queryImage'), async (req, res, next) => {
    try {
        if (!req.file) {
            throw new AppError('検索クエリ画像が必要です', 400, 'NO_QUERY_IMAGE');
        }

        const amount = 1;
        console.log(`[Search] Similar search request from tenant: ${req.tenantId}`);

        const results = await drawingSearchService.searchSimilarDrawing(
            req.tenantId,
            req.file.buffer
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
        next(error);
    }
});

module.exports = router;
