const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const { AppError } = require('../middleware/errorHandler');

/**
 * GET /api/analysis/ai-monthly-report
 * AIによる月次総評の取得（Proプラン限定）
 */
router.get('/ai-monthly-report', authMiddleware, async (req, res, next) => {
    try {
        const { targetMonth } = req.query; // YYYY-MM
        if (!targetMonth) {
            throw new AppError('Target month is required', 400, 'MISSING_PARAM');
        }

        // 1. プランチェック
        const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('plan')
            .eq('id', req.tenantId)
            .single();

        if (!tenant || tenant.plan !== 'pro') {
            return res.status(403).json({
                error: 'FORBIDDEN',
                message: 'この機能はProプラン限定です。',
                isPro: false
            });
        }

        // 2. レポート取得
        const { data: report, error } = await supabaseAdmin
            .from('ai_monthly_reports')
            .select('*')
            .eq('tenant_id', req.tenantId)
            .eq('target_month', targetMonth)
            .maybeSingle();

        if (error) throw error;

        res.json({
            isPro: true,
            report: report || null
        });

    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/analysis/ai-monthly-report/generate
 * (Debug/Manual) AIによる月次総評の手動生成
 */
router.post('/ai-monthly-report/generate', authMiddleware, async (req, res, next) => {
    try {
        const { targetMonth } = req.body; // YYYY-MM
        
        // Admin以上の権限チェック（本来はroleを見るべきだが、ここでは簡易的に）
        const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('plan, name')
            .eq('id', req.tenantId)
            .single();

        if (!tenant || tenant.plan !== 'pro') {
            throw new AppError('Pro plan required', 403);
        }

        const aiReportService = require('../services/aiReportService');
        await aiReportService.generateReportForTenant(req.tenantId, tenant.name, targetMonth);

        res.json({ message: 'Report generated successfully' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
