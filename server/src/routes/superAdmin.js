const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware, requireRole, requireMFA } = require('../middleware/auth');
const { PLAN_CONFIG } = require('../config/stripe');
const systemLimits = require('../config/systemLimits');

// 全てのルートに認証、system_admin/super_admin ロール、および MFA を要求
router.use(authMiddleware);
router.use(requireRole('super_admin'));
router.use(requireMFA);

/**
 * サービス全体の統計取得
 * GET /api/super-admin/stats
 */
router.get('/stats', async (req, res) => {
    try {
        // 全テナント数
        const { count: tenantCount, error: tError } = await supabaseAdmin
            .from('tenants')
            .select('*', { count: 'exact', head: true });

        if (tError) throw tError;

        // 有効ユーザー数（無効化ユーザーを除外）
        const { count: userCount, error: uError } = await supabaseAdmin
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        if (uError) throw uError;

        // プラン別内訳
        const { data: plans, error: pError } = await supabaseAdmin
            .from('tenants')
            .select('plan');

        if (pError) throw pError;

        const planStats = plans.reduce((acc, curr) => {
            const planKey = curr.plan || 'free';
            acc[planKey] = (acc[planKey] || 0) + 1;
            return acc;
        }, { free: 0, lite: 0, plus: 0, pro: 0 });

        res.json({
            tenants: tenantCount,
            users: userCount,
            plans: planStats,
            updatedAt: new Date().toISOString()
        });
    } catch (err) {
        console.error('[SuperAdmin API] Stats Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

/**
 * 全テナント一覧取得
 * GET /api/super-admin/tenants
 */
router.get('/tenants', async (req, res) => {
    try {
        const { data: tenants, error } = await supabaseAdmin
            .from('tenants')
            .select(`
                id,
                name,
                slug,
                plan,
                created_at,
                subscriptions (
                    status,
                    current_period_end
                ),
                ai_credits (
                    balance,
                    monthly_quota,
                    purchased_balance
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // ストレージ使用量の集計 (全量取得してサーバーサイドで集計)
        const { data: allFiles } = await supabaseAdmin
            .from('quotation_files')
            .select('tenant_id, file_size');

        const storageMap = allFiles?.reduce((acc, f) => {
            acc[f.tenant_id] = (acc[f.tenant_id] || 0) + (f.file_size || 0);
            return acc;
        }, {}) || {};

        // 扱いやすいようにフラットに整形
        const formattedTenants = tenants.map(t => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            plan: t.plan,
            createdAt: t.created_at,
            status: t.subscriptions?.status || 'no_subscription',
            expiryDate: t.subscriptions?.current_period_end,
            creditBalance: t.ai_credits?.balance || 0,
            monthlyQuota: t.ai_credits?.monthly_quota || 0,
            purchasedBalance: t.ai_credits?.purchased_balance || 0,
            storageUsage: storageMap[t.id] || 0,
            maxStorageGB: PLAN_CONFIG[t.plan]?.maxStorageGB || 1 // 設定ファイルから取得助
        }));

        res.json(formattedTenants);
    } catch (err) {
        console.error('[SuperAdmin API] Tenants Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch tenants' });
    }
});

/**
 * 特定テナントの詳細・ユーザー一覧取得
 * GET /api/super-admin/tenants/:id
 */
router.get('/tenants/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // テナント基本情報
        const { data: tenant, error: tError } = await supabaseAdmin
            .from('tenants')
            .select('*')
            .eq('id', id)
            .single();

        if (tError) throw tError;

        // ユーザー一覧
        const { data: users, error: uError } = await supabaseAdmin
            .from('users')
            .select('id, email, name, role, is_active, created_at')
            .eq('tenant_id', id)
            .order('created_at', { ascending: true });

        if (uError) throw uError;

        // クレジット情報
        const { data: credits, error: cError } = await supabaseAdmin
            .from('ai_credits')
            .select('*')
            .eq('tenant_id', id)
            .single();

        res.json({
            tenant,
            users,
            credits
        });
    } catch (err) {
        console.error('[SuperAdmin API] Tenant Detail Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch tenant details' });
    }
});

/**
 * システムヘルスの詳細取得
 * GET /api/super-admin/health
 */
router.get('/health', async (req, res) => {
    try {
        console.log('[SuperAdmin API] Fetching system health...');
        const health = {
            db: 'online',
            storage: 'online',
            ai: 'online',
            timestamp: new Date().toISOString(),
            limits: {
                geminiRpm: systemLimits.GEMINI_RPM_LIMIT
            }
        };

        // 1. DBチェック
        const { error: dbError } = await supabaseAdmin.from('tenants').select('id', { head: true, count: 'exact' }).limit(1);
        if (dbError) {
            console.error('[Health] DB Error:', dbError);
            health.db = 'error';
        }

        // 2. Storageチェック
        const { error: storageError } = await supabaseAdmin.storage.listBuckets();
        if (storageError) {
            console.error('[Health] Storage Error:', storageError);
            health.storage = 'error';
        }

        // 3. AIチェック (Gemini)
        try {
            const aiService = require('../services/aiService');
            // モデルが初期化されているか、かつ簡単なリクエストが通るか確認したいが
            // クォータ節約のため「モデル定義の存在確認」に留める
            if (!aiService.model) health.ai = 'error';
        } catch (e) {
            console.error('[Health] AI Service Error:', e);
            health.ai = 'error';
        }

        res.json(health);
    } catch (err) {
        console.error('[SuperAdmin API] General Health Error:', err);
        res.status(500).json({ error: 'Failed to fetch health status' });
    }
});

/**
 * 最近のアクティビティ取得
 * GET /api/super-admin/activities
 */
router.get('/activities', async (req, res) => {
    try {
        console.log('[SuperAdmin API] Fetching activities...');
        // 1. 新規テナント (直近5件)
        const { data: newTenants } = await supabaseAdmin
            .from('tenants')
            .select('name, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        // 2. 新規ユーザー (直近5件)
        const { data: newUsers } = await supabaseAdmin
            .from('users')
            .select('name, created_at, tenants(name)')
            .order('created_at', { ascending: false })
            .limit(5);

        // 3. クレジット履歴 (消費、購入、プラン変更)
        const { data: creditTxs } = await supabaseAdmin
            .from('ai_credit_transactions')
            .select('type, amount, description, created_at, tenants(name)')
            .order('created_at', { ascending: false })
            .limit(20);

        // アクティビティの集約と整形
        const activities = [];

        if (newTenants) {
            newTenants.forEach(t => {
                activities.push({
                    type: 'tenant_created',
                    title: '新規登録',
                    detail: `${t.name} がプラットフォームに参加しました`,
                    time: t.created_at,
                    color: 'blue',
                    icon: 'Building2'
                });
            });
        }

        if (newUsers) {
            newUsers.forEach(u => {
                activities.push({
                    type: 'user_created',
                    title: 'ユーザー追加',
                    detail: `${u.tenants?.name || u.name} に新しいユーザーが追加されました`,
                    time: u.created_at,
                    color: 'indigo',
                    icon: 'UserPlus'
                });
            });
        }

        if (creditTxs) {
            creditTxs.forEach(a => {
                if (a.type === 'usage') {
                    activities.push({
                        type: 'ai_usage',
                        title: 'AI解析実行',
                        detail: `${a.tenants?.name || '不明'} が ${a.description} を行いました`,
                        time: a.created_at,
                        color: 'emerald',
                        icon: 'Zap'
                    });
                } else if (a.type === 'purchase' || a.type === 'plan_change') {
                    activities.push({
                        type: 'billing',
                        title: a.type === 'purchase' ? 'クレジット購入' : 'プラン変更',
                        detail: `${a.tenants?.name || '不明'}: ${a.description}`,
                        time: a.created_at,
                        color: 'amber',
                        icon: 'CreditCard'
                    });
                }
            });
        }

        // 時系列でソート（新しい順）
        const sortedActivities = activities
            .sort((a, b) => new Date(b.time) - new Date(a.time))
            .slice(0, 15);

        res.json(sortedActivities);
    } catch (err) {
        console.error('[SuperAdmin API] Activity Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

/**
 * リソース利用量統計の取得
 * GET /api/super-admin/usage
 */
router.get('/usage', async (req, res) => {
    try {
        console.log('[SuperAdmin API] Fetching resource usage...');

        // 1. 企業別の合計ストレージ使用量 (Top 10)
        const { data: storageUsage } = await supabaseAdmin
            .from('quotation_files')
            .select('tenant_id, file_size, tenants(name)');

        const storageByTenant = storageUsage?.reduce((acc, curr) => {
            const name = curr.tenants?.name || '不明';
            if (!acc[name]) acc[name] = 0;
            acc[name] += (curr.file_size || 0);
            return acc;
        }, {}) || {};

        const sortedStorage = Object.entries(storageByTenant)
            .map(([name, size]) => ({ name, size }))
            .sort((a, b) => b.size - a.size)
            .slice(0, 10);

        // 2. 企業別の AI 解析履歴 (直近30日の消費量順)
        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: aiUsage } = await supabaseAdmin
            .from('ai_credit_transactions')
            .select('tenant_id, amount, type, created_at, tenants(name)')
            .eq('type', 'usage')
            .gte('created_at', last30Days.toISOString());

        const aiByTenant = aiUsage?.reduce((acc, curr) => {
            const name = curr.tenants?.name || '不明';
            if (!acc[name]) acc[name] = 0;
            acc[name] += Math.abs(curr.amount || 0);
            return acc;
        }, {}) || {};

        const sortedAi = Object.entries(aiByTenant)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // 今月1日からの合計解析数
        const monthUsage = aiUsage?.filter(tx =>
            tx.type === 'usage' && new Date(tx.created_at) >= startOfMonth
        ).length || 0;

        // コスト見積もり (Gemini 1.5 Flash: 約 0.1円 / 解析)
        const estimatedCost = monthUsage * 0.1;

        // 3. 全体の合計値
        const totalStorage = storageUsage?.reduce((sum, curr) => sum + (curr.file_size || 0), 0) || 0;
        const totalAi = aiUsage?.reduce((sum, curr) => sum + Math.abs(curr.amount || 0), 0) || 0;

        res.json({
            storage: sortedStorage,
            ai: sortedAi,
            totals: {
                storage: totalStorage,
                ai: totalAi,
                db: 0,
                monthUsage: monthUsage,
                estimatedCost: estimatedCost
            },
            storageLimit: systemLimits.STORAGE_LIMIT_BYTES,
            dbLimit: systemLimits.DATABASE_LIMIT_BYTES
        });
    } catch (err) {
        console.error('[SuperAdmin API] Usage Stats Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch usage statistics' });
    }
});

/**
 * 決済・売上統計の取得
 * GET /api/super-admin/billing
 */
router.get('/billing', async (req, res) => {
    try {
        console.log('[SuperAdmin API] Fetching billing stats...');
        const { PLAN_CONFIG, CREDIT_CONFIG } = require('../config/stripe');

        // 1. 全サブスクリプション取得
        const { data: subs } = await supabaseAdmin
            .from('subscriptions')
            .select('plan, status, tenant_id, tenants(name)')
            .in('status', ['active', 'trialing', 'past_due', 'unpaid', 'incomplete']);

        // 2. 当月のクレジット購入履歴取得
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: creditTxs } = await supabaseAdmin
            .from('ai_credit_transactions')
            .select('amount, created_at')
            .eq('type', 'purchase')
            .gte('created_at', startOfMonth.toISOString());

        // MRR 計算
        let mrr = 0;
        const alerts = [];

        subs?.forEach(s => {
            const config = PLAN_CONFIG[s.plan];
            if (config && (s.status === 'active' || s.status === 'trialing')) {
                mrr += (config.amount || 0);
            }

            // アラート (支払い遅延など)
            if (s.status === 'past_due' || s.status === 'unpaid' || s.status === 'incomplete') {
                alerts.push({
                    tenantName: s.tenants?.name || '不明',
                    status: s.status,
                    plan: s.plan
                });
            }
        });

        // クレジット売上計算
        let creditRevenue = 0;
        creditTxs?.forEach(tx => {
            // CREDIT_CONFIG から金額を逆引き (credits フィールドで一致を確認)
            const config = Object.values(CREDIT_CONFIG).find(c => c.credits === tx.amount);
            if (config) {
                creditRevenue += config.amount;
            } else {
                // 万が一設定に見当たらない場合は 1クレジット=10円 で概算 (フォールバック)
                creditRevenue += tx.amount * 10;
            }
        });

        res.json({
            mrr,                    // 月間定常収益 (サブスクのみ)
            creditRevenue,          // 当月のスポット売上 (クレジットのみ)
            totalRevenue: mrr + creditRevenue, // 当月の総売上
            activeCount: subs?.filter(s => s.status === 'active' || s.status === 'trialing').length || 0,
            alerts
        });
    } catch (err) {
        console.error('[SuperAdmin API] Billing Stats Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch billing statistics' });
    }
});

/**
 * システムログの取得 (エラーログ)
 * GET /api/super-admin/logs/errors
 */
router.get('/logs/errors', async (req, res) => {
    try {
        const { limit = 50, offset = 0, tenantId, source, level } = req.query;
        let query = supabaseAdmin
            .from('system_error_logs')
            .select('*, tenants(name)')
            .order('created_at', { ascending: false })
            .range(offset, parseInt(offset) + parseInt(limit) - 1);

        if (tenantId) query = query.eq('tenant_id', tenantId);
        if (source) query = query.eq('source', source);
        if (level) query = query.eq('level', level);

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('[SuperAdmin API] Error Logs Fetch Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch error logs' });
    }
});

/**
 * システムログの取得 (アクセスログ)
 * GET /api/super-admin/logs/access
 */
router.get('/logs/access', async (req, res) => {
    try {
        const { limit = 100, offset = 0, tenantId, method, status } = req.query;
        let query = supabaseAdmin
            .from('system_access_logs')
            .select('*, tenants(name)')
            .order('created_at', { ascending: false })
            .range(offset, parseInt(offset) + parseInt(limit) - 1);

        if (tenantId) query = query.eq('tenant_id', tenantId);
        if (method) query = query.eq('method', method);
        if (status) query = query.eq('status_code', status);

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('[SuperAdmin API] Access Logs Fetch Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch access logs' });
    }
});

/**
 * システムログの取得 (監査ログ)
 * GET /api/super-admin/logs/audit
 */
router.get('/logs/audit', async (req, res) => {
    try {
        const { limit = 50, offset = 0, tenantId, action, entityType } = req.query;
        let query = supabaseAdmin
            .from('audit_logs')
            .select('*, tenants(name)')
            .order('created_at', { ascending: false })
            .range(offset, parseInt(offset) + parseInt(limit) - 1);

        if (tenantId) query = query.eq('tenant_id', tenantId);
        if (action) query = query.eq('action', action);
        if (entityType) query = query.eq('entity_type', entityType);

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('[SuperAdmin API] Audit Logs Fetch Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

module.exports = router;
