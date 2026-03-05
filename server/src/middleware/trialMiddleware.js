const { supabaseAdmin } = require('../config/supabase');

/**
 * トライアル期限チェックミドルウェア
 * 無料プランかつ期限切れの場合は 402 (Payment Required) を返す。
 */
const checkTrialLimit = async (req, res, next) => {
    try {
        const tenantId = req.tenantId;
        if (!tenantId || tenantId === 'platform') {
            return next();
        }

        const { data: tenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .select('plan, trial_ends_at')
            .eq('id', tenantId)
            .single();

        if (tenantError || !tenant) {
            return next();
        }

        // 1. 無料プランのトライアルチェック
        if (tenant.plan === 'free') {
            const trialEndsAt = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
            if (trialEndsAt && new Date() > trialEndsAt) {
                return res.status(402).json({
                    error: 'Trial expired',
                    code: 'TRIAL_EXPIRED',
                    message: '無料トライアル期間が終了しました。有料プランへの移行が必要です。'
                });
            }
        } else {
            // 2. 有料プランの期限チェック
            const { data: sub } = await supabaseAdmin
                .from('subscriptions')
                .select('status, current_period_end')
                .eq('tenant_id', tenantId)
                .maybeSingle();

            if (sub) {
                // ステータスによる明示的なブロック
                if (['canceled', 'unpaid', 'incomplete_expired'].includes(sub.status)) {
                    return res.status(402).json({
                        error: 'Subscription inactive',
                        code: 'SUBSCRIPTION_INACTIVE',
                        message: 'サブスクリプションが無効です。お支払い情報の更新が必要です。'
                    });
                }

                const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
                // 有効ステータス（active, past_due等）であっても、日付が過ぎていればブロック
                if (periodEnd && new Date() > periodEnd) {
                    return res.status(402).json({
                        error: 'Subscription expired',
                        code: 'SUBSCRIPTION_EXPIRED',
                        message: 'サブスクリプションの有効期限が終了しました。お支払い情報の更新が必要です。'
                    });
                }
            }
        }

        next();
    } catch (err) {
        console.error('[Trial Middleware] Error:', err.message);
        next(); // エラー時は念のため通す
    }
};

module.exports = { checkTrialLimit };
