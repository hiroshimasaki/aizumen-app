const express = require('express');
const router = express.Router();
const { stripe, PLAN_CONFIG } = require('../config/stripe');
const { supabaseAdmin } = require('../config/supabase');

/**
 * POST /api/webhooks/stripe
 * Stripe Webhook 受信
 * ※ express.raw() を使用するため、index.jsでjsonパース前に登録
 */
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('[Webhook] Signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;

            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object);
                break;

            default:
                console.log(`[Webhook] Unhandled event type: ${event.type}`);
        }
    } catch (err) {
        console.error(`[Webhook] Error handling ${event.type}:`, err);
    }

    // Stripeには常に200を返す
    res.json({ received: true });
});

const { grantCredits } = require('../services/creditService');

/**
 * チェックアウト完了時の処理
 */
async function handleCheckoutCompleted(session) {
    const { type, tenant_id, plan, credits } = session.metadata || {};
    if (!tenant_id) return;

    if (type === 'subscription') {
        const planConfig = PLAN_CONFIG[plan];
        if (!planConfig) return;

        // サブスクリプション情報を取得
        const subscription = await stripe.subscriptions.retrieve(session.subscription);

        // DBにサブスクリプション情報を保存
        await supabaseAdmin
            .from('subscriptions')
            .upsert({
                tenant_id,
                stripe_customer_id: session.customer,
                stripe_subscription_id: session.subscription,
                plan,
                max_users: planConfig.maxUsers,
                status: 'active',
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            }, { onConflict: 'tenant_id' });

        // テナントのプランを更新
        await supabaseAdmin
            .from('tenants')
            .update({ plan, updated_at: new Date().toISOString() })
            .eq('id', tenant_id);

        // AIクレジットの月間枠を更新し、付与
        await updateCreditsOnPlanChange(tenant_id, planConfig.monthlyCredits);

        console.log(`[Webhook] Subscription activated for tenant ${tenant_id}: ${plan}`);
    }
    else if (type === 'credit_purchase') {
        const amount = parseInt(credits);
        console.log(`[Webhook] Credit purchase metadata - tenant: ${tenant_id}, amount: ${amount}`);

        // 既に付与済みかどうかをトランザクション履歴から確認（WebhookとVerifyの競争回避）
        const { data: existingTx } = await supabaseAdmin
            .from('ai_credit_transactions')
            .select('id')
            .eq('tenant_id', tenant_id)
            .eq('type', 'purchase')
            .eq('description', `Stripe Purchase: ${session.id}`)
            .maybeSingle();

        if (!existingTx) {
            await grantCredits(tenant_id, amount, 'purchase', `Stripe Purchase: ${session.id}`);
            console.log(`[Webhook] Credits granted for tenant ${tenant_id}: ${amount}`);
        } else {
            console.log(`[Webhook] Credits already granted for session ${session.id}`);
        }
    }
}

/**
 * サブスクリプション更新時の処理
 */
async function handleSubscriptionUpdated(subscription) {
    console.log(`[Webhook] Processing subscription update: ${subscription.id}`);

    const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('tenant_id, plan')
        .eq('stripe_subscription_id', subscription.id)
        .single();

    if (!sub) {
        console.log(`[Webhook] No matching subscription found in DB for ${subscription.id}`);
        return;
    }

    const tenant_id = sub.tenant_id;
    const status = subscription.status;

    // プランの変更をチェック（メタデータまたは価格IDから判定）
    let newPlan = subscription.metadata?.plan || sub.plan;

    // メタデータにない場合、価格IDから逆引きを試みる（プラン変更時）
    if (!subscription.metadata?.plan) {
        const priceId = subscription.items.data[0].price.id;
        for (const [key, config] of Object.entries(PLAN_CONFIG)) {
            if (config.priceId === priceId) {
                newPlan = key;
                break;
            }
        }
    }

    console.log(`[Webhook] Updating sub for tenant ${tenant_id}. Status: ${status}, Plan: ${newPlan}`);

    const updates = {
        status,
        plan: newPlan,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
    };

    // プラン名から制限値を再取得
    const planConfig = PLAN_CONFIG[newPlan];
    if (planConfig) {
        updates.max_users = planConfig.maxUsers;
    }

    await supabaseAdmin
        .from('subscriptions')
        .update(updates)
        .eq('stripe_subscription_id', subscription.id);

    // テナント本体のプラン区分も更新
    await supabaseAdmin
        .from('tenants')
        .update({ plan: newPlan, updated_at: new Date().toISOString() })
        .eq('id', tenant_id);

    // AIクレジットの月間枠も更新（アップグレード・ダウングレード対応）
    if (newPlan !== sub.plan && planConfig) {
        console.log(`[Webhook] Syncing credits for plan change: ${sub.plan} -> ${newPlan}`);
        await updateCreditsOnPlanChange(tenant_id, planConfig.monthlyCredits);

        // ダウングレード時: ライセンス超過ユーザーの自動無効化
        if (planConfig.maxUsers) {
            const { data: activeUsers } = await supabaseAdmin
                .from('users')
                .select('id, name, role, created_at')
                .eq('tenant_id', tenant_id)
                .eq('is_active', true)
                .order('created_at', { ascending: true });

            if (activeUsers && activeUsers.length > planConfig.maxUsers) {
                console.log(`[Webhook] License exceeded: ${activeUsers.length} active users, max ${planConfig.maxUsers}`);

                // 管理者を優先し、その後は作成日順（古い順）で有効化対象を決定
                const admins = activeUsers.filter(u => u.role === 'admin');
                const nonAdmins = activeUsers.filter(u => u.role !== 'admin');

                // 管理者 → 一般ユーザー（作成日順）の順で並べ、上位N名を有効のままにする
                const sorted = [...admins, ...nonAdmins];
                const keepActive = sorted.slice(0, planConfig.maxUsers);
                const toDeactivate = sorted.slice(planConfig.maxUsers);

                if (toDeactivate.length > 0) {
                    const deactivateIds = toDeactivate.map(u => u.id);
                    await supabaseAdmin
                        .from('users')
                        .update({ is_active: false, updated_at: new Date().toISOString() })
                        .in('id', deactivateIds);

                    console.log(`[Webhook] Auto-deactivated ${toDeactivate.length} users:`, toDeactivate.map(u => u.name).join(', '));
                    console.log(`[Webhook] Kept active ${keepActive.length} users:`, keepActive.map(u => u.name).join(', '));
                }
            }
        }
    }

    console.log(`[Webhook] Successfully updated tenant ${tenant_id} to ${newPlan}`);
}

/**
 * サブスクリプション解約時の処理
 */
async function handleSubscriptionDeleted(subscription) {
    await supabaseAdmin
        .from('subscriptions')
        .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id);
}

/**
 * 支払い失敗時の処理
 */
async function handlePaymentFailed(invoice) {
    console.warn(`[Webhook] Payment failed for customer: ${invoice.customer}`);
    // TODO: 管理者への通知メール送信
}

module.exports = router;
