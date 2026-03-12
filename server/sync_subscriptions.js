require('dotenv').config();
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// --- 設定 ---
const STRIPE_SECRET_KEY = process.env.PROD_STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL; // 本番のURLを指定して実行すること
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stripe = new Stripe(STRIPE_SECRET_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncSubscriptions(targetId) {
    console.log(`--- Stripe Subscription Sync START [Target ID: ${targetId || 'ALL'}] ---`);
    
    if (!STRIPE_SECRET_KEY) {
        console.error('Error: PROD_STRIPE_SECRET_KEY が設定されていません。');
        return;
    }

    try {
        let subscriptions = [];
        
        if (targetId && targetId.startsWith('cus_')) {
            // カスタマーIDが指定された場合
            console.log(`Fetching subscriptions for Customer: ${targetId}`);
            const response = await stripe.subscriptions.list({
                customer: targetId,
                status: 'active'
            });
            subscriptions = response.data;
        } else {
            // 全アクティブなサブスクリプションをリストアップ
            const response = await stripe.subscriptions.list({
                status: 'active',
                expand: ['data.customer']
            });
            subscriptions = response.data;
        }

        console.log(`Found ${subscriptions.length} active subscriptions to process.\n`);

        for (const sub of subscriptions) {
            // テナントIDの特定 (メタデータ または 引数)
            let tenantId = sub.metadata.tenant_id || (sub.customer && sub.customer.metadata ? sub.customer.metadata.tenant_id : null);
            
            // 引数が UUID (tenant_id) 形式で、かつメタデータにない場合のフォールバック
            if (!tenantId && targetId && !targetId.startsWith('cus_')) {
                tenantId = targetId;
            }

            // 引数がカスタマーIDの場合の固定テナントID (今回のユーザーケース用)
            if (targetId === 'cus_U6s2Was3NAb2fH') {
                tenantId = 'c94934bf-d5b4-4e94-8987-60d07db7c022';
            }

            if (!tenantId) {
                console.warn(`[SKIP] No tenant_id found for Subscription: ${sub.id}`);
                continue;
            }

            console.log(`Processing: Tenant ${tenantId} (Sub: ${sub.id})`);

            const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

            const currentPeriodEnd = sub.current_period_end 
                ? new Date(sub.current_period_end * 1000).toISOString() 
                : new Date().toISOString();

            // DBを更新（または挿入）
            const { error } = await supabase
                .from('subscriptions')
                .upsert({
                    tenant_id: tenantId,
                    stripe_customer_id: customerId,
                    stripe_subscription_id: sub.id,
                    plan: sub.metadata.plan_type || 'standard',
                    status: sub.status,
                    current_period_end: currentPeriodEnd
                }, { onConflict: 'tenant_id' });

            if (error) {
                console.error(`  - ERROR updating DB: ${error.message}`);
            } else {
                console.log(`  - SUCCESS: Updated ${tenantId}`);
            }
        }

    } catch (err) {
        console.error('Main loop error:', err.message);
    }

    console.log('\n--- Stripe Subscription Sync FINISHED ---');
}

// 実行
const idArg = process.argv[2];
syncSubscriptions(idArg);
