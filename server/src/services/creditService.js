const { supabaseAdmin } = require('../config/supabase');
const { AppError } = require('../middleware/errorHandler');

/**
 * AIクレジットの残高を取得する
 */
const getCreditBalance = async (tenantId) => {
    // Super Admin (platform) の場合はダミーの無制限クレジットを返す
    if (tenantId === 'platform') {
        return {
            balance: 999999,
            monthly_quota: 999999,
            purchased_balance: 0
        };
    }

    let { data, error } = await supabaseAdmin
        .from('ai_credits')
        .select('balance, monthly_quota, purchased_balance')
        .eq('tenant_id', tenantId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            const { data: newData, error: insertError } = await supabaseAdmin
                .from('ai_credits')
                .insert({
                    tenant_id: tenantId,
                    balance: 0,
                    monthly_quota: 0,
                    purchased_balance: 0,
                    last_reset_at: new Date().toISOString()
                })
                .select('balance, monthly_quota, purchased_balance')
                .single();
            return newData;
        }
        throw new AppError('Failed to fetch credit balance', 500);
    }
    return data;
};

/**
 * AIクレジットを消費する
 */
const consumeCredits = async (tenantId, userId, amount, description = 'OCR Analysis') => {
    // RPC (ストアドプロシージャ) を呼び出してアトミックに消費
    // 内部で残高チェック、ロック、更新、履歴挿入が完結します
    const { data, error } = await supabaseAdmin.rpc('consume_ai_credits_atomic', {
        p_tenant_id: tenantId,
        p_amount: amount,
        p_user_id: userId,
        p_description: description
    });

    if (error) {
        // 残高不足などの例外を適切に処理
        if (error.message.includes('不足')) {
            throw new AppError(error.message, 402, 'INSUFFICIENT_CREDITS');
        }
        console.error('[CreditService] RPC Error:', error);
        throw new AppError(error.message || 'クレジット消費に失敗しました', 500);
    }

    return data;
};

/**
 * AIクレジットを付与する (課金時やリセット用)
 */
const grantCredits = async (tenantId, amount, type = 'purchase', description = 'Manual grant') => {
    const current = await getCreditBalance(tenantId);

    const updates = {
        balance: current.balance + amount,
        updated_at: new Date().toISOString()
    };

    // 購入(purchase)の場合は purchased_balance も増やす
    if (type === 'purchase') {
        updates.purchased_balance = (current.purchased_balance || 0) + amount;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
        .from('ai_credits')
        .update(updates)
        .eq('tenant_id', tenantId)
        .select()
        .single();

    if (updateError) throw new AppError('Failed to update credit balance', 500);

    await supabaseAdmin
        .from('ai_credit_transactions')
        .insert({
            tenant_id: tenantId,
            amount,
            type,
            description,
        });

    return updated;
};

/**
 * 月次クレジットリセット (1日に実行)
 * Carry-over rule: purchased_balance は維持し、monthly_quota を新しく上書きする
 */
const resetMonthlyCredits = async (tenantId, newMonthlyQuota) => {
    const current = await getCreditBalance(tenantId);

    // 新しい合計残高 = 購入済み残高 + 新しい月間枠
    const newTotalBalance = (current.purchased_balance || 0) + newMonthlyQuota;

    const { data, error } = await supabaseAdmin
        .from('ai_credits')
        .update({
            balance: newTotalBalance,
            monthly_quota: newMonthlyQuota,
            last_reset_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .select()
        .single();

    if (error) throw new AppError('Monthly reset failed', 500);

    await supabaseAdmin.from('ai_credit_transactions').insert({
        tenant_id: tenantId,
        amount: newMonthlyQuota,
        type: 'monthly_grant',
        description: `月間枠のリセット (${newMonthlyQuota} pts)`
    });

    return data;
};

/**
 * プラン変更時のAIクレジット更新
 * Carry-over rule: purchased_balance は維持し、月間枠の「差分」を追加する
 */
const updateCreditsOnPlanChange = async (tenantId, newMonthlyQuota) => {
    const current = await getCreditBalance(tenantId);
    const oldMonthlyQuota = current.monthly_quota || 0;

    // アップグレードなら差分を加算、ダウングレードなら（必要に応じて）減算
    // ただし基本的には「新しい枠」に切り替える際、既存の使用分は差し引いた状態にする
    const diff = newMonthlyQuota - oldMonthlyQuota;

    const newBalance = Math.max(0, current.balance + diff);

    const { data: updated, error: updateError } = await supabaseAdmin
        .from('ai_credits')
        .update({
            balance: newBalance,
            monthly_quota: newMonthlyQuota,
            updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .select()
        .single();

    if (updateError) throw new AppError('Failed to sync credits for plan change', 500);

    // 履歴に残す
    await supabaseAdmin.from('ai_credit_transactions').insert({
        tenant_id: tenantId,
        amount: diff,
        type: 'plan_change',
        description: `プラン変更に伴うクレジット調整: ${oldMonthlyQuota} -> ${newMonthlyQuota} pts`
    });

    return updated;
};

module.exports = {
    getCreditBalance,
    consumeCredits,
    grantCredits,
    resetMonthlyCredits,
    updateCreditsOnPlanChange,
};
