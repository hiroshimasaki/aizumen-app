const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const creditService = require('../services/creditService');

/**
 * GET /api/credits/balance
 * 現在のテナントのAIクレジット残高を取得する
 */
router.get('/balance', authMiddleware, async (req, res, next) => {
    try {
        const balance = await creditService.getCreditBalance(req.tenantId);
        res.json(balance);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
