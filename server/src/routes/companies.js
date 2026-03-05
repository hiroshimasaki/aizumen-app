const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const { AppError } = require('../middleware/errorHandler');

/**
 * GET /api/companies
 * 取引先一覧
 */
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        // Super Admin (platform) の場合は取引先データを返さない
        if (req.tenantId === 'platform') {
            return res.json([]);
        }

        const { data, error } = await supabaseAdmin
            .from('companies')
            .select('id, name, contact_info, created_at')
            .eq('tenant_id', req.tenantId)
            .order('name', { ascending: true });

        if (error) throw new AppError('Failed to fetch companies', 500, 'FETCH_FAILED');
        res.json(data);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/companies
 * 取引先追加
 */
router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const { name, contactInfo } = req.body;
        if (!name) throw new AppError('Company name is required', 400, 'VALIDATION_ERROR');

        const { data, error } = await supabaseAdmin
            .from('companies')
            .upsert(
                { tenant_id: req.tenantId, name, contact_info: contactInfo || {} },
                { onConflict: 'tenant_id,name' }
            )
            .select()
            .single();

        if (error) throw new AppError('Failed to create company', 500, 'CREATE_FAILED');
        res.status(201).json(data);
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /api/companies/:id
 * 取引先更新
 */
router.put('/:id', authMiddleware, async (req, res, next) => {
    try {
        const { name, contactInfo } = req.body;
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (contactInfo !== undefined) updates.contact_info = contactInfo;

        const { data, error } = await supabaseAdmin
            .from('companies')
            .update(updates)
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId)
            .select()
            .single();

        if (error) throw new AppError('Failed to update company', 500, 'UPDATE_FAILED');
        res.json(data);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
