const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const { AppError } = require('../middleware/errorHandler');

/**
 * GET /api/export/quotations
 * 案件データをエクスポート (CSV/JSON)
 */
router.get('/quotations', authMiddleware, requireRole('system_admin'), async (req, res, next) => {
    try {
        const { format = 'csv' } = req.query;

        // データの取得 (論理削除されていないもののみ)
        const { data, error } = await supabaseAdmin
            .from('quotations')
            .select('*, quotation_items(*)')
            .eq('tenant_id', req.tenantId)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false });

        if (error) throw new AppError('Failed to fetch data for export', 500, 'EXPORT_FAILED');

        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=quotations_export.json');
            return res.json(data);
        }

        // CSV 生成
        const headers = [
            '案件ID', '見積ID', '会社名', '注文番号', '工事番号', 'ステータス',
            '合計金額', '作成日', '更新日', '納品予定日', 'メモ'
        ];

        // BOM付き UTF-8
        let csvContent = '\uFEFF';
        csvContent += headers.join(',') + '\n';

        data.forEach(q => {
            const row = [
                q.id,
                q.display_id,
                `"${(q.company_name || '').replace(/"/g, '""')}"`,
                `"${(q.order_number || '').replace(/"/g, '""')}"`,
                `"${(q.construction_number || '').replace(/"/g, '""')}"`,
                q.status,
                q.total_amount || 0,
                q.created_at,
                q.updated_at,
                q.delivery_date || '',
                `"${(q.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
            ];
            csvContent += row.join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=quotations_export.csv');
        res.send(csvContent);

    } catch (err) {
        next(err);
    }
});

module.exports = router;
