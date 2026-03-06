const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const { stripe, PLAN_CONFIG } = require('../config/stripe');
const { AppError } = require('../middleware/errorHandler');
const logService = require('../services/logService');

/**
 * GET /api/subscription
 * 現在のサブスクリプション情報
 */
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        let { data: sub } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('tenant_id', req.tenantId)
            .single();

        const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('plan')
            .eq('id', req.tenantId)
            .single();

        // 自己修復ロジックの追加助
        if (sub && (sub.status === 'active' || sub.status === 'past_due')) {
            if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) {
                console.log(`[Subscription/GET] Self-healing: Subscription for tenant ${req.tenantId} has expired.`);

                await supabaseAdmin
                    .from('subscriptions')
                    .update({
                        status: 'canceled',
                        updated_at: new Date().toISOString()
                    })
                    .eq('tenant_id', req.tenantId);

                await supabaseAdmin
                    .from('tenants')
                    .update({
                        plan: 'free',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', req.tenantId);

                // 再取得または手動更新助
                sub.status = 'canceled';
                if (tenant) tenant.plan = 'free';
            }
        }

        const plan = tenant?.plan || 'lite';
        const planConfig = PLAN_CONFIG[plan];

        // 1. ユーザー数カウント
        const { count: userCount } = await supabaseAdmin
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', req.tenantId)
            .eq('is_active', true);

        // 2. ストレージ使用量取得
        const { data: usageData } = await supabaseAdmin
            .from('quotation_files')
            .select('file_size')
            .eq('tenant_id', req.tenantId);

        const storageUsage = usageData?.reduce((sum, f) => sum + (f.file_size || 0), 0) || 0;

        res.json({
            subscription: sub,
            plan: {
                name: planConfig?.name || plan,
                maxUsers: planConfig?.maxUsers || 1,
                currentUsers: userCount || 0,
                monthlyCredits: planConfig?.monthlyCredits || 200,
                storageUsage, // current bytes
                maxStorageGB: planConfig?.maxStorageGB || 1
            }
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/subscription/stripe-details
 * Stripeから詳細情報（支払い方法、ダウングレード予約等）を取得
 * ※時間がかかるため非同期で個別に呼び出す
 */
router.get('/stripe-details', authMiddleware, async (req, res, next) => {
    try {
        const { data: sub } = await supabaseAdmin
            .from('subscriptions')
            .select('stripe_subscription_id, stripe_customer_id')
            .eq('tenant_id', req.tenantId)
            .single();

        const results = {
            paymentMethod: null,
            pending_plan: null,
            cancel_at_period_end: false
        };

        // 並列でStripeに問い合わせ
        const stripePromises = [];

        // 1. サブスクリプション詳細（キャンセル予約等）の確認
        if (sub.stripe_subscription_id) {
            stripePromises.push(
                stripe.subscriptions.retrieve(sub.stripe_subscription_id)
                    .then(async (stripeSub) => {
                        results.cancel_at_period_end = stripeSub.cancel_at_period_end;

                        if (sub) {
                            let updated = false;
                            const updates = {};

                            // 1. cancel_at_period_end の同期
                            if (sub.cancel_at_period_end !== stripeSub.cancel_at_period_end) {
                                updates.cancel_at_period_end = stripeSub.cancel_at_period_end;
                                updated = true;
                            }

                            // 2. 修復ロジック（ステータスが canceled/expired の場合にフリープランへ強制移行）
                            if ((stripeSub.status === 'canceled' || stripeSub.status === 'incomplete_expired') && sub.status === 'active') {
                                console.log(`[StripeDetails] Self-healing: Subscription ${stripeSub.id} is ${stripeSub.status}. Reverting DB and Tenant to free.`);
                                updates.status = 'canceled';
                                updated = true;

                                // テナント側もフリープランへ
                                await supabaseAdmin
                                    .from('tenants')
                                    .update({ plan: 'free', updated_at: new Date().toISOString() })
                                    .eq('id', req.tenantId);
                            }

                            if (updated) {
                                console.log(`[StripeDetails] Syncing subscriptions table for ${stripeSub.id}:`, updates);
                                await supabaseAdmin
                                    .from('subscriptions')
                                    .update({ ...updates, updated_at: new Date().toISOString() })
                                    .eq('stripe_subscription_id', stripeSub.id);
                            }
                        }

                        if (stripeSub.schedule) {
                            const schedule = await stripe.subscriptionSchedules.retrieve(stripeSub.schedule);
                            results.pending_plan = schedule.metadata?.pending_plan || null;
                        }
                    })
                    .catch(err => console.error('[StripeDetails] Subscription retrieve error:', err.message))
            );
        }

        // 2. 支払い方法（カード情報）の取得
        if (sub.stripe_customer_id) {
            stripePromises.push(
                stripe.customers.retrieve(sub.stripe_customer_id, {
                    expand: ['invoice_settings.default_payment_method']
                })
                    .then(async (customer) => {
                        let pm = customer.invoice_settings?.default_payment_method;

                        if (!pm) {
                            const paymentMethods = await stripe.paymentMethods.list({
                                customer: sub.stripe_customer_id,
                                type: 'card',
                                limit: 1,
                            });
                            if (paymentMethods.data.length > 0) {
                                pm = paymentMethods.data[0];
                            }
                        }

                        if (pm && pm.card) {
                            results.paymentMethod = {
                                brand: pm.card.brand,
                                last4: pm.card.last4,
                            };
                        }
                    })
                    .catch(err => console.error('[StripeDetails] Customer retrieve error:', err.message))
            );
        }

        await Promise.all(stripePromises);

        res.json(results);
    } catch (err) {
        console.error('[StripeDetails] Unexpected error:', err);
        res.status(500).json({ error: 'Failed to fetch stripe details' });
    }
});

/**
 * GET /api/subscription/debug
 * デバッグ用：生データを返す
 */
router.get('/debug', authMiddleware, async (req, res, next) => {
    try {
        // adminロールチェック
        if (req.userRole !== 'admin') {
            return res.status(403).json({ error: 'Admin role required' });
        }

        const { data: sub } = await supabaseAdmin.from('subscriptions').select('*').eq('tenant_id', req.tenantId).maybeSingle();
        const { data: tenant } = await supabaseAdmin.from('tenants').select('*').eq('id', req.tenantId).maybeSingle();
        const { data: credits } = await supabaseAdmin.from('ai_credits').select('*').eq('tenant_id', req.tenantId).maybeSingle();

        res.json({
            status: 'ok',
            tenantId: req.tenantId,
            planData: {
                tenantPlan: tenant?.plan,
                subPlan: sub?.plan,
                balance: credits?.balance,
                quota: credits?.monthly_quota
            },
            config: {
                stripeSecretSet: !!process.env.STRIPE_SECRET_KEY,
                webhookSecretSet: !!process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_WEBHOOK_SECRET !== 'whsec_xxx'
            }
        });
    } catch (err) {
        console.error('[Debug Route] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/subscription/checkout
 * Stripeチェックアウトセッション作成
 */
router.post('/checkout', authMiddleware, requireRole('system_admin'), async (req, res, next) => {
    try {
        const { plan } = req.body;

        const planConfig = PLAN_CONFIG[plan];
        if (!planConfig) throw new AppError('Invalid plan', 400, 'INVALID_PLAN');

        const priceId = planConfig.priceId;
        if (!priceId) throw new AppError('Price not configured', 500, 'PRICE_NOT_CONFIGURED');

        // 既存のサブスクリプションを確認
        const { data: existingSub } = await supabaseAdmin
            .from('subscriptions')
            .select('stripe_subscription_id, stripe_customer_id, status, plan')
            .eq('tenant_id', req.tenantId)
            .maybeSingle();

        // 既存のアクティブなサブスクリプションがある場合
        if (existingSub?.stripe_subscription_id && existingSub?.status === 'active') {
            const currentPlanConfig = PLAN_CONFIG[existingSub.plan];
            const isDowngrade = (planConfig.amount || 0) < (currentPlanConfig?.amount || 0);

            const stripeSubscription = await stripe.subscriptions.retrieve(existingSub.stripe_subscription_id);

            if (isDowngrade) {
                // ダウングレード → 次回更新時に適用（Subscription Schedulesを使用）
                console.log(`[Subscription] Scheduling downgrade: ${existingSub.plan} -> ${plan} at next renewal`);

                let scheduleId = stripeSubscription.schedule;
                if (!scheduleId) {
                    const schedule = await stripe.subscriptionSchedules.create({
                        from_subscription: stripeSubscription.id,
                    });
                    scheduleId = schedule.id;
                }

                const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
                const currentPhase = schedule.phases[0];

                await stripe.subscriptionSchedules.update(scheduleId, {
                    end_behavior: 'release',
                    metadata: { pending_plan: plan },
                    phases: [
                        {
                            start_date: currentPhase.start_date,
                            end_date: currentPhase.end_date,
                            items: currentPhase.items.map(item => ({
                                price: item.price,
                                quantity: item.quantity,
                            })),
                        },
                        {
                            items: [{ price: priceId, quantity: 1 }],
                            metadata: { plan: plan }
                        }
                    ]
                });

                // DBへの保存は不要。WebhookとGET API側でStripeを参照する。
                await logService.audit({
                    action: 'subscription_downgrade_scheduled',
                    entityType: 'subscription',
                    entityId: existingSub.stripe_subscription_id,
                    description: `Downgrade scheduled: ${existingSub.plan} -> ${plan}`,
                    tenantId: req.tenantId,
                    userId: req.userId
                });
                return res.json({ scheduled: true, plan, currentPlan: existingSub.plan });
            }

            // アップグレード → 即時適用（日割り計算）
            console.log(`[Subscription] Upgrading subscription: ${existingSub.plan} -> ${plan}`);

            // 既存のスケジュール（ダウングレード予約など）があれば解除
            if (stripeSubscription.schedule) {
                await stripe.subscriptionSchedules.release(stripeSubscription.schedule);
            }

            const updatedSubscription = await stripe.subscriptions.update(existingSub.stripe_subscription_id, {
                items: [{
                    id: stripeSubscription.items.data[0].id,
                    price: priceId,
                }],
                metadata: {
                    tenant_id: req.tenantId,
                    plan,
                },
                proration_behavior: 'create_prorations',
            });

            // DB即時更新
            await supabaseAdmin
                .from('subscriptions')
                .update({
                    plan,
                    max_users: planConfig.maxUsers,
                    cancel_at_period_end: updatedSubscription.cancel_at_period_end || false,
                    current_period_start: new Date(updatedSubscription.current_period_start * 1000).toISOString(),
                    current_period_end: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('tenant_id', req.tenantId);

            await supabaseAdmin
                .from('tenants')
                .update({ plan, updated_at: new Date().toISOString() })
                .eq('id', req.tenantId);

            // AIクレジットも更新（差分付与ロジックを呼び出し）
            const { updateCreditsOnPlanChange } = require('../services/creditService');
            await updateCreditsOnPlanChange(req.tenantId, planConfig.monthlyCredits);

            console.log(`[Subscription] Plan upgraded successfully: ${plan}`);
            await logService.audit({
                action: 'subscription_upgrade_immediate',
                entityType: 'subscription',
                entityId: existingSub.stripe_subscription_id,
                description: `Immediate upgrade: ${existingSub.plan} -> ${plan}`,
                tenantId: req.tenantId,
                userId: req.userId
            });
            return res.json({ updated: true, plan });
        }

        // 新規サブスクリプション → Stripe Checkout
        const checkoutParams = {
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${process.env.APP_URL}/admin?tab=billing&success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.APP_URL}/admin?tab=billing&canceled=true`,
            metadata: {
                type: 'subscription',
                tenant_id: req.tenantId,
                plan,
            },
            subscription_data: {
                metadata: {
                    tenant_id: req.tenantId,
                    plan,
                }
            }
        };

        // 既存のStripe顧客IDがあれば紐付ける
        if (existingSub?.stripe_customer_id) {
            checkoutParams.customer = existingSub.stripe_customer_id;
        }

        const session = await stripe.checkout.sessions.create(checkoutParams);

        res.json({ url: session.url });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/subscription/checkout/verify
 * Checkout完了後のセッション検証・DB同期（Webhookのフォールバック）
 */
router.post('/checkout/verify', authMiddleware, requireRole('system_admin'), async (req, res, next) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) throw new AppError('Session ID is required', 400, 'VALIDATION_ERROR');

        // Stripeからセッション情報を取得
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (!session || session.payment_status !== 'paid') {
            throw new AppError('Payment not completed', 400, 'PAYMENT_INCOMPLETE');
        }

        const { type, tenant_id, plan, credits } = session.metadata || {};
        if (tenant_id !== req.tenantId) {
            throw new AppError('Invalid session tenant', 403, 'FORBIDDEN');
        }

        // --- クレジット追加購入の場合 ---
        if (type === 'credit_purchase') {
            const amount = parseInt(credits);
            if (isNaN(amount) || amount <= 0) throw new AppError('Invalid credit amount in session', 400, 'INVALID_AMOUNT');

            // 既に付与済みかどうかをトランザクション履歴から確認（WebhookとVerifyの競争回避）
            const { data: existingTx } = await supabaseAdmin
                .from('ai_credit_transactions')
                .select('id')
                .eq('tenant_id', tenant_id)
                .eq('type', 'purchase')
                .eq('description', `Stripe Purchase: ${sessionId}`)
                .maybeSingle();

            if (!existingTx) {
                // creditService を読み込んでクレジット付与
                const { grantCredits } = require('../services/creditService');
                await grantCredits(tenant_id, amount, 'purchase', `Stripe Purchase: ${sessionId}`);
                console.log(`[Checkout/Verify] Credits granted for tenant ${tenant_id}: ${amount}`);
            }

            return res.json({ synced: true, type: 'credits', amount });
        }

        // --- サブスクリプション変更(新規登録)の場合 ---
        if (type !== 'subscription') {
            throw new AppError('Invalid session type', 400, 'INVALID_SESSION_TYPE');
        }

        const planConfig = PLAN_CONFIG[plan];
        if (!planConfig) throw new AppError('Invalid plan in session', 400, 'INVALID_PLAN');

        // サブスクリプション情報を取得
        const subscription = await stripe.subscriptions.retrieve(session.subscription);

        // DBにサブスクリプション情報を保存（handleCheckoutCompletedと同じ処理）
        await supabaseAdmin
            .from('subscriptions')
            .upsert({
                tenant_id,
                stripe_customer_id: session.customer,
                stripe_subscription_id: session.subscription,
                plan,
                max_users: planConfig.maxUsers,
                status: 'active',
                cancel_at_period_end: subscription.cancel_at_period_end || false,
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            }, { onConflict: 'tenant_id' });

        // テナントのプランを更新
        await supabaseAdmin
            .from('tenants')
            .update({ plan, updated_at: new Date().toISOString() })
            .eq('id', tenant_id);

        // AIクレジットの月間枠を更新し、付与
        const { updateCreditsOnPlanChange } = require('../services/creditService');
        await updateCreditsOnPlanChange(tenant_id, planConfig.monthlyCredits);

        console.log(`[Checkout/Verify] Subscription synced for tenant ${tenant_id}: ${plan}`);
        await logService.audit({
            action: 'subscription_verify',
            entityType: 'subscription',
            entityId: session.subscription,
            description: `Subscription verified: ${plan}`,
            tenantId: tenant_id,
            userId: req.userId
        });
        res.json({ synced: true, plan });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/subscription/cancel-downgrade
 * 予約されているダウングレード（Subscription Schedule）を取り消す
 */
router.post('/cancel-downgrade', authMiddleware, requireRole('system_admin'), async (req, res, next) => {
    try {
        const { data: sub } = await supabaseAdmin
            .from('subscriptions')
            .select('stripe_subscription_id')
            .eq('tenant_id', req.tenantId)
            .single();

        if (!sub?.stripe_subscription_id) {
            throw new AppError('No active subscription found', 404, 'NO_SUBSCRIPTION');
        }

        const stripeSubscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);

        if (stripeSubscription.schedule) {
            console.log(`[Subscription] Canceling scheduled downgrade for subscription ${sub.stripe_subscription_id}`);
            // スケジュールをリリース（削除ではなくリリースすることで、現在のサブスクリプションがそのまま継続される）
            await stripe.subscriptionSchedules.release(stripeSubscription.schedule);

            await logService.audit({
                action: 'subscription_downgrade_canceled',
                entityType: 'subscription',
                entityId: sub.stripe_subscription_id,
                description: `Downgrade schedule canceled`,
                tenantId: req.tenantId,
                userId: req.userId
            });
            res.json({ status: 'canceled', message: 'Downgrade schedule canceled successfully' });
        } else {
            res.status(400).json({ error: 'No scheduled downgrade found' });
        }
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/subscription/portal
 * Stripeカスタマーポータルのセッション作成
 */
router.post('/portal', authMiddleware, requireRole('system_admin'), async (req, res, next) => {
    try {
        const { data: sub } = await supabaseAdmin
            .from('subscriptions')
            .select('stripe_customer_id')
            .eq('tenant_id', req.tenantId)
            .single();

        if (!sub?.stripe_customer_id) {
            throw new AppError('No active subscription found', 404, 'NO_SUBSCRIPTION');
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: sub.stripe_customer_id,
            return_url: `${process.env.APP_URL}/admin/subscription`,
        });

        res.json({ url: session.url });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/subscription/credits/purchase
 * AIクレジット追加購入
 */
router.post('/credits/purchase', authMiddleware, requireRole('system_admin'), async (req, res, next) => {
    try {
        const { creditAmount, useStoredCard } = req.body; // '200', '1000', '2000'

        // フリープランはクレジット購入不可
        const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('plan, name')
            .eq('id', req.tenantId)
            .single();
        if (tenant?.plan === 'free') {
            throw new AppError('フリープランではクレジットの追加購入はできません。有料プランにアップグレードしてください。', 403, 'FREE_PLAN_RESTRICTED');
        }

        const { CREDIT_CONFIG } = require('../config/stripe');
        const config = CREDIT_CONFIG[String(creditAmount)];
        if (!config) throw new AppError('Invalid credit amount', 400, 'INVALID_AMOUNT');

        const { data: sub } = await supabaseAdmin
            .from('subscriptions')
            .select('stripe_customer_id')
            .eq('tenant_id', req.tenantId)
            .single();

        if (useStoredCard && sub?.stripe_customer_id) {
            console.log(`[Credits] One-click charge for tenant ${req.tenantId}: ${creditAmount} pts`);

            // 顧客情報を取得してデフォルト支払い方法を確認
            const customer = await stripe.customers.retrieve(sub.stripe_customer_id, {
                expand: ['invoice_settings.default_payment_method']
            });

            let pmId = customer.invoice_settings?.default_payment_method;
            if (pmId && typeof pmId === 'object') pmId = pmId.id;

            // もしデフォルトがなければ、リストから取得を試みる
            if (!pmId) {
                const pms = await stripe.paymentMethods.list({
                    customer: sub.stripe_customer_id,
                    type: 'card',
                    limit: 1
                });
                if (pms.data.length > 0) {
                    pmId = pms.data[0].id;
                }
            }

            if (!pmId) {
                console.warn(`[Credits] No payment method found for customer ${sub.stripe_customer_id}. Falling back to Checkout.`);
                // 続行して下の CheckoutSession パスへ
            } else {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: config.amount,
                    currency: 'jpy',
                    customer: sub.stripe_customer_id,
                    payment_method: pmId,
                    off_session: true,
                    confirm: true,
                    description: `AIクレジット購入: ${config.credits} pts (${tenant.name})`,
                    receipt_email: customer.email, // 領収書の自動送付
                    metadata: {
                        type: 'credit_purchase',
                        tenant_id: req.tenantId,
                        credits: config.credits,
                    },
                });

                if (paymentIntent.status === 'succeeded') {
                    const { grantCredits } = require('../services/creditService');
                    await grantCredits(req.tenantId, config.credits, 'purchase', `One-click: ${paymentIntent.id}`);

                    await logService.audit({
                        action: 'credit_purchase_oneclick',
                        entityType: 'credits',
                        description: `One-click purchase: ${config.credits} pts`,
                        tenantId: req.tenantId,
                        userId: req.userId
                    });

                    return res.json({ success: true, balanceIncrement: config.credits });
                } else {
                    throw new AppError(`決済が完了しませんでした (Status: ${paymentIntent.status})。別のカードをお試しください。`, 402, 'PAYMENT_FAILED');
                }
            }
        }

        // Stripe Checkout画面へ飛ばす従来方式（新規カード入力など）
        const checkoutParams = {
            mode: 'payment',
            payment_method_types: ['card'],
            customer: sub?.stripe_customer_id, // 既存顧客ならログイン状態で表示
            line_items: [{ price: config.priceId, quantity: 1 }],
            success_url: `${process.env.APP_URL}/admin?tab=billing&success=true&type=credits&amount=${creditAmount}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.APP_URL}/admin?tab=billing&canceled=true`,
            metadata: {
                type: 'credit_purchase',
                tenant_id: req.tenantId,
                credits: config.credits,
            },
        };

        const session = await stripe.checkout.sessions.create(checkoutParams);
        res.json({ url: session.url });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
