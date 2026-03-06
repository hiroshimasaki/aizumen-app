const { supabaseAdmin } = require('../config/supabase');
const { PLAN_CONFIG } = require('../config/stripe');
const { AppError } = require('./errorHandler');

/**
 * テナントのストレージ使用量がプランの上限を超えていないかチェックするミドルウェア
 */
const checkStorageLimit = async (req, res, next) => {
    try {
        const tenantId = req.tenantId;
        if (!tenantId) return next(new AppError('Tenant ID is missing', 400));

        // 1. テナントの現在のプランを取得
        const { data: tenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .select('plan')
            .eq('id', tenantId)
            .single();

        if (tenantError || !tenant) {
            return next(new AppError('Tenant not found', 404));
        }

        const plan = tenant.plan || 'free';
        const planConfig = PLAN_CONFIG[plan];

        // 上限設定がない場合はスキップ（念のため）
        if (!planConfig || !planConfig.maxStorageGB) {
            return next();
        }

        const maxStorageBytes = planConfig.maxStorageGB * 1024 * 1024 * 1024;

        // 2. 現在の使用量（合計ファイルサイズ）を取得
        const { data: usageData, error: usageError } = await supabaseAdmin
            .from('quotation_files')
            .select('file_size')
            .eq('tenant_id', tenantId);

        if (usageError) {
            console.error('[StorageLimit] Failed to fetch usage:', usageError);
            return next(new AppError('Failed to check storage capacity', 500));
        }

        const currentUsageBytes = usageData.reduce((sum, file) => sum + (file.file_size || 0), 0);

        // 3. 新規アップロード予定のサイズを加算（multer の req.file または req.files がある場合）
        let incomingBytes = 0;
        if (req.file) {
            incomingBytes = req.file.size;
        } else if (req.files && Array.isArray(req.files)) {
            incomingBytes = req.files.reduce((sum, f) => sum + f.size, 0);
        } else if (req.files && typeof req.files === 'object') {
            // フィールド指定の multer の場合
            Object.values(req.files).forEach(fileArray => {
                incomingBytes += fileArray.reduce((sum, f) => sum + f.size, 0);
            });
        }

        if (currentUsageBytes + incomingBytes > maxStorageBytes) {
            return next(new AppError('ストレージ容量が超過しています。', 403, 'STORAGE_LIMIT_EXCEEDED'));
        }

        next();
    } catch (err) {
        console.error('[StorageLimit] Unexpected error:', err);
        next(err);
    }
};

module.exports = { checkStorageLimit };
