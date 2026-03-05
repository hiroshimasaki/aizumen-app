const { supabaseAdmin } = require('../config/supabase');
const { AppError } = require('./errorHandler');

/**
 * AIクレジット確認ミドルウェア
 * 指定量のクレジットが残っているかチェック。不足時は402を返す。
 */
const checkCredits = (amount) => {
    return async (req, res, next) => {
        try {
            const { data, error } = await supabaseAdmin
                .from('ai_credits')
                .select('balance')
                .eq('tenant_id', req.tenantId)
                .single();

            if (error || !data) {
                throw new AppError('AI credit account not found', 404, 'CREDITS_NOT_FOUND');
            }

            if (data.balance < amount) {
                throw new AppError(
                    `Insufficient AI credits. Required: ${amount}, Balance: ${data.balance}`,
                    402,
                    'INSUFFICIENT_CREDITS'
                );
            }

            req.creditCost = amount;
            req.currentCredits = data.balance;
            next();
        } catch (err) {
            if (err.isOperational) return next(err);
            next(new AppError('Failed to check AI credits', 500, 'CREDIT_CHECK_FAILED'));
        }
    };
};

module.exports = { checkCredits };
