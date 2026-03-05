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
    const current = await getCreditBalance(tenantId);
    if (current.balance < amount) {
        throw new AppError(`クレジットが不足しています。必要: ${amount}, 残高: ${current.balance}`, 402, 'INSUFFICIENT_CREDITS');
    }

    // 追加購入分(purchased_balance) と 通常枠の 계산
    let currentPurchased = current.purchased_balance || 0;
    let currentRegular = current.balance - currentPurchased;
    if (currentRegular < 0) currentRegular = 0; // 念のため

    let newPurchased = currentPurchased;
    let newRegular = currentRegular;

    // まず通常枠から減算
    if (newRegular >= amount) {
        newRegular -= amount;
    } else {
        // 通常枠が足りない場合は、足りない分を追加購入枠から減算
        const remainder = amount - newRegular;
        newRegular = 0;
        newPurchased -= remainder;
    }

    const newBalance = newRegular + newPurchased;

    const { data: updated, error: updateError } = await supabaseAdmin
        .from('ai_credits')
        .update({
            balance: newBalance,
            purchased_balance: newPurchased,
            updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .select()
        .single();

    if (updateError) throw new AppError('Failed to update credit balance', 500);

    const { error: txError } = await supabaseAdmin
        .from('ai_credit_transactions')
        .insert({
            tenant_id: tenantId,
            user_id: userId,
            amount: -amount,
            type: 'usage',
            description,
        });

    return updated;
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
        description: `Monthly quota reset (${newMonthlyQuota} pts)`
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
        description: `Plan changed: ${oldMonthlyQuota} -> ${newMonthlyQuota} pts`
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
