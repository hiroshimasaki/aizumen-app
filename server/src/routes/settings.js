const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const { AppError } = require('../middleware/errorHandler');
const logService = require('../services/logService');

/**
 * GET /api/settings
 * テナント設定取得
 */
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        // Super Admin (platform) の場合はデフォルトの空設定を返す
        if (req.tenantId === 'platform') {
            return res.json({ tenant_id: 'platform', ocr_prompt: null, scan_storage_path: null, settings_json: {} });
        }

        const { data, error } = await supabaseAdmin
            .from('tenant_settings')
            .select('*')
            .eq('tenant_id', req.tenantId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw new AppError('Failed to fetch settings', 500, 'FETCH_FAILED');
        }

        res.json(data || { tenant_id: req.tenantId, ocr_prompt: null, scan_storage_path: null, settings_json: {} });
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /api/settings
 * テナント設定更新（admin専用）
 */
router.put('/', authMiddleware, requireRole('admin'), async (req, res, next) => {
    try {
        const { ocrPrompt, scanStoragePath, settingsJson } = req.body;
        const updates = { updated_at: new Date().toISOString() };

        if (ocrPrompt !== undefined) updates.ocr_prompt = ocrPrompt;
        if (scanStoragePath !== undefined) updates.scan_storage_path = scanStoragePath;
        if (settingsJson !== undefined) updates.settings_json = settingsJson;

        const { data, error } = await supabaseAdmin
            .from('tenant_settings')
            .update(updates)
            .eq('tenant_id', req.tenantId)
            .select()
            .single();

        if (error) throw new AppError('Failed to update settings', 500, 'UPDATE_FAILED');

        await logService.audit({
            action: 'tenant_settings_updated',
            entityType: 'settings',
            description: `テナント設定を更新しました`,
            tenantId: req.tenantId,
            userId: req.userId
        });

        // hourlyRate または autoLostDays があれば tenants テーブルも更新
        if (req.body.hourlyRate !== undefined || req.body.autoLostDays !== undefined) {
            const { data: currentTenant } = await supabaseAdmin
                .from('tenants')
                .select('settings, hourly_rate')
                .eq('id', req.tenantId)
                .single();

            const tUpdates = { updated_at: new Date().toISOString() };
            
            if (req.body.hourlyRate !== undefined) {
                tUpdates.hourly_rate = Number(req.body.hourlyRate);
            }

            if (req.body.autoLostDays !== undefined) {
                const currentSettings = currentTenant?.settings || {};
                tUpdates.settings = {
                    ...currentSettings,
                    auto_lost_days: Number(req.body.autoLostDays)
                };
            }

            const { error: tError } = await supabaseAdmin
                .from('tenants')
                .update(tUpdates)
                .eq('id', req.tenantId);

            if (tError) console.error('Failed to update tenants table:', tError);
        }

        res.json(data);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/settings/company
 * 企業名・連絡先取得（一般からのアクセスも可。プラン等の判定に使用）
 */
router.get('/company', authMiddleware, async (req, res, next) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('tenants')
            .select('*')
            .eq('id', req.tenantId)
            .single();

        if (error) throw new AppError('Failed to fetch company info', 500, 'FETCH_FAILED');
        res.json(data);
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /api/settings/company
 * 企業名・連絡先更新（admin専用）
 */
router.put('/company', authMiddleware, requireRole('admin'), async (req, res, next) => {
    try {
        const { name, address, phone, website, hourlyRate, zip, fax, email, themeType } = req.body;
        if (!name) throw new AppError('Company name is required', 400, 'VALIDATION_ERROR');

        // カラムが存在しない可能性に備え、まず既存のデータを取得して settings JSON を更新する
        const { data: currentTenant } = await supabaseAdmin
            .from('tenants')
            .select('settings')
            .eq('id', req.tenantId)
            .single();

        const currentSettings = currentTenant?.settings || {};
        const updatedSettings = {
            ...currentSettings,
            theme_type: themeType || 'industrial'
        };

        const updates = {
            name,
            address,
            phone,
            website,
            zip,
            fax,
            email,
            settings: updatedSettings,
            hourly_rate: hourlyRate !== undefined ? hourlyRate : 8000,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabaseAdmin
            .from('tenants')
            .update(updates)
            .eq('id', req.tenantId)
            .select()
            .single();

        if (error) throw new AppError('Failed to update company info', 500, 'UPDATE_FAILED');

        await logService.audit({
            action: 'company_info_updated',
            entityType: 'tenant',
            entityId: req.tenantId,
            description: `企業情報を更新しました: ${name}`,
            tenantId: req.tenantId,
            userId: req.userId
        });

        res.json(data);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
