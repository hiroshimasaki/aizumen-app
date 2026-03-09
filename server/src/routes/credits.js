const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const creditService = require('../services/creditService');

/**
 * GET /api/credits/balance
 * 現在のテナントのAIクレジット残高を取得する
 */
router.get('/balance', authMiddleware, async (req, res, next) => {
    console.log(`[Credits/Balance] DEBUG: Request received from user: ${req.user?.email}`);
    try {
        const balance = await creditService.getCreditBalance(req.tenantId);
        console.log(`[Credits/Balance] DEBUG: Balance for tenant ${req.tenantId}:`, balance);
        res.json(balance);
    } catch (err) {
        console.error(`[Credits/Balance] DEBUG: Error:`, err);
        next(err);
    }
});

module.exports = router;
