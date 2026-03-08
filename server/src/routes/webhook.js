const express = require('express');
const router = express.Router();
const { stripe, PLAN_CONFIG } = require('../config/stripe');
const { supabaseAdmin } = require('../config/supabase');
const logService = require('../services/logService');

/**
 * GET /api/webhook
 * 疎通確認用
 */
router.get('/', (req, res) => {
    res.json({ status: 'active', message: 'AiZumen Stripe Webhook Endpoint' });
});

/**
 * POST /api/webhook
 * Stripe Webhook 受信
 * ※ express.raw() を使用するため、index.jsでjsonパース前に登録
 */
router.post('/', (req, res, next) => {
    console.log(`[Webhook] Raw request hit: ${req.method} ${req.url}`);
    next();
}, express.raw({ type: 'application/json' }), async (req, res) => {
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

const { grantCredits, updateCreditsOnPlanChange } = require('../services/creditService');

/**
 * チェックアウト完了時の処理
 */
async function handleCheckoutCompleted(session) {
    console.log(`[Webhook/Checkout] Processing session: ${session.id}, Metadata:`, session.metadata);
    const { type, tenant_id, plan, credits } = session.metadata || {};
    
    if (!tenant_id) {
        console.error(`[Webhook/Checkout] Missing tenant_id in session metadata for: ${session.id}`);
        return;
    }

    if (type === 'subscription') {
        const { getPlanConfig } = require('../config/stripe');
        const planConfig = getPlanConfig(plan);

        if (!planConfig) {
            console.error(`[Webhook/Checkout] Unknown plan configuration for metadata.plan: "${plan}"`);
            return;
        }

        // サブスクリプション情報を取得
        const subscription = await stripe.subscriptions.retrieve(session.subscription);

        // DBにサブスクリプション情報を保存
        const { error: subError } = await supabaseAdmin
            .from('subscriptions')
            .upsert({
                tenant_id,
                stripe_customer_id: session.customer,
                stripe_subscription_id: session.subscription,
                plan: plan.toLowerCase(), // 正規化して保存
                status: 'active',
                cancel_at_period_end: subscription.cancel_at_period_end || false,
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            }, { onConflict: 'tenant_id' });

        if (subError) {
            console.error(`[Webhook/DB] Error upserting subscription for tenant ${tenant_id}:`, JSON.stringify(subError, null, 2));
            throw subError; // catchブロックで拾わせる
        }

        // テナントのプランを更新し、無料トライアルを終了(null)にする
        await supabaseAdmin
            .from('tenants')
            .update({ plan: plan.toLowerCase(), trial_ends_at: null, updated_at: new Date().toISOString() })
            .eq('id', tenant_id);

        // AIクレジットの月間枠を更新し、付与
        await updateCreditsOnPlanChange(tenant_id, planConfig.monthlyCredits);

        console.log(`[Webhook] Subscription activated for tenant ${tenant_id}: ${plan}`);

        await logService.audit({
            action: 'subscription_activated',
            entityType: 'subscription',
            description: `サブスクリプション有効化: ${plan}`,
            tenantId: tenant_id
        });
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
        cancel_at_period_end: subscription.cancel_at_period_end,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
    };

    // プラン名から制限値を再取得
    const { getPlanConfig } = require('../config/stripe');
    const planConfig = getPlanConfig(newPlan);
    if (planConfig) {
        updates.max_users = planConfig.maxUsers;
    }

    await supabaseAdmin
        .from('subscriptions')
        .update(updates)
        .eq('stripe_subscription_id', subscription.id);

    // テナント本体のプラン区分とトライアル状態を更新
    const tenantUpdates = { plan: newPlan, updated_at: new Date().toISOString() };
    if (newPlan !== 'free') {
        tenantUpdates.trial_ends_at = null;
    }

    await supabaseAdmin
        .from('tenants')
        .update(tenantUpdates)
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

    await logService.audit({
        action: 'subscription_updated',
        entityType: 'subscription',
        description: `サブスクリプション更新: ${newPlan} (状態: ${status})`,
        tenantId: tenant_id
    });
}

/**
 * サブスクリプション解約時の処理
 */
async function handleSubscriptionDeleted(subscription) {
    console.log(`[Webhook] Subscription deleted/canceled: ${subscription.id}`);

    // DBのサブスクステータスを更新
    const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id)
        .select('tenant_id')
        .single();

    if (sub?.tenant_id) {
        // テナントをフリープランへ戻す
        await supabaseAdmin
            .from('tenants')
            .update({
                plan: 'free',
                updated_at: new Date().toISOString()
            })
            .eq('id', sub.tenant_id);
        console.log(`[Webhook] Tenant ${sub.tenant_id} reverted to free plan.`);

        await logService.audit({
            action: 'subscription_deleted',
            entityType: 'subscription',
            description: `サブスクリプション終了: フリープランへ移行しました`,
            tenantId: sub.tenant_id
        });
    }
}

/**
 * 支払い失敗時の処理
 */
async function handlePaymentFailed(invoice) {
    console.warn(`[Webhook] Payment failed for customer: ${invoice.customer}`);
    
    // 監査ログに記録（将来的なメール通知の実装まで、管理画面で確認可能にする）
    await logService.audit({
        action: 'payment_failed',
        entityType: 'subscription',
        entityId: invoice.id,
        description: `決済失敗: カスタマーID ${invoice.customer} (請求金額: ${invoice.amount_due} ${invoice.currency})`,
    });
}

module.exports = router;
