const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const { AppError } = require('../middleware/errorHandler');

/**
 * GET /api/material-prices
 * 材質単価マスタ一覧取得
 */
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('material_prices')
            .select('*')
            .eq('tenant_id', req.tenantId)
            .order('material_type', { ascending: true })
            .order('min_dim', { ascending: true });

        if (error) throw new AppError('Failed to fetch material prices', 500, 'FETCH_FAILED');
        res.json(data);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/material-prices
 * 材質単価マスタ追加 (Admin専用)
 */
router.post('/', authMiddleware, requireRole('admin'), async (req, res, next) => {
    try {
        const { vendorName, materialType, shape, minDim, maxDim, basePriceType, unitPrice, density, cuttingCostFactor, overheadFactor } = req.body;
        
        if (!vendorName || !materialType || !shape || unitPrice === undefined || density === undefined) {
            throw new AppError('Required fields are missing', 400, 'VALIDATION_ERROR');
        }

        const { data, error } = await supabaseAdmin
            .from('material_prices')
            .insert({
                tenant_id: req.tenantId,
                vendor_name: vendorName,
                material_type: materialType,
                shape: shape,
                min_dim: Number(minDim) || 0,
                max_dim: Number(maxDim) || 999999,
                base_price_type: basePriceType || 'kg',
                unit_price: Number(unitPrice),
                density: Number(density),
                cutting_cost_factor: Number(cuttingCostFactor) || 0,
                overhead_factor: Number(overheadFactor) || 1.0
            })
            .select()
            .single();

        if (error) throw new AppError('Failed to create material price', 500, 'CREATE_FAILED');
        res.status(201).json(data);
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /api/material-prices/:id
 * 材質単価マスタ更新 (Admin専用)
 */
router.put('/:id', authMiddleware, requireRole('admin'), async (req, res, next) => {
    try {
        const { vendorName, materialType, shape, minDim, maxDim, basePriceType, unitPrice, density, cuttingCostFactor, overheadFactor, isActive } = req.body;
        
        const updates = { updated_at: new Date().toISOString() };
        if (vendorName !== undefined) updates.vendor_name = vendorName;
        if (materialType !== undefined) updates.material_type = materialType;
        if (shape !== undefined) updates.shape = shape;
        if (minDim !== undefined) updates.min_dim = Number(minDim);
        if (maxDim !== undefined) updates.max_dim = Number(maxDim);
        if (basePriceType !== undefined) updates.base_price_type = basePriceType;
        if (unitPrice !== undefined) updates.unit_price = Number(unitPrice);
        if (density !== undefined) updates.density = Number(density);
        if (cuttingCostFactor !== undefined) updates.cutting_cost_factor = Number(cuttingCostFactor);
        if (overheadFactor !== undefined) updates.overhead_factor = Number(overheadFactor);
        if (isActive !== undefined) updates.is_active = isActive;

        const { data, error } = await supabaseAdmin
            .from('material_prices')
            .update(updates)
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId)
            .select()
            .single();

        if (error) throw new AppError('Failed to update material price', 500, 'UPDATE_FAILED');
        res.json(data);
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/material-prices/:id
 * 材質単価マスタ削除 (Admin専用)
 */
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res, next) => {
    try {
        const { error } = await supabaseAdmin
            .from('material_prices')
            .delete()
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId);

        if (error) throw new AppError('Failed to delete material price', 500, 'DELETE_FAILED');
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});

module.exports = router;
