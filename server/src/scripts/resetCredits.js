const { supabaseAdmin } = require('../config/supabase');
const { resetMonthlyCredits } = require('../services/creditService');

/**
 * すべてのテナントの月次クレジットをリセットするスクリプト
 * 実行例: node src/scripts/resetCredits.js
 */
async function runReset() {
    console.log('[ResetCredits] Starting monthly credit reset...');

    // 全テナント取得
    const { data: tenants, error } = await supabaseAdmin
        .from('tenants')
        .select('id, plan');

    if (error) {
        console.error('[ResetCredits] Failed to fetch tenants:', error);
        return;
    }

    for (const tenant of tenants) {
        try {
            // プランに応じた月間付与額（仮定）
            let quota = 100; // Lite
            if (tenant.plan === 'plus') quota = 500;
            if (tenant.plan === 'pro') quota = 2000;

            console.log(`[ResetCredits] Resetting tenant ${tenant.id} (${tenant.plan}) to ${quota} pts`);
            await resetMonthlyCredits(tenant.id, quota);
        } catch (err) {
            console.error(`[ResetCredits] Failed for tenant ${tenant.id}:`, err.message);
        }
    }

    console.log('[ResetCredits] Finished.');
}

runReset();
