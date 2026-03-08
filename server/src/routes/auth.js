const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { supabaseAdmin } = require('../config/supabase');
const authService = require('../services/authService');
const { authMiddleware } = require('../middleware/auth');
const { PLAN_CONFIG } = require('../config/stripe');
const { AppError } = require('../middleware/errorHandler');
const logService = require('../services/logService');

/**
 * POST /api/auth/signup
 * テナント + 管理者アカウント作成
 */
router.post('/signup', async (req, res, next) => {
    try {
        const { email, password, userName, companyName, companyCode, plan } = req.body;
        const result = await authService.signUp({ email, password, userName, companyName, companyCode, plan });

        await logService.audit({
            action: 'tenant_signup',
            entityType: 'tenant',
            entityId: result.tenant.id,
            description: `新規テナント登録: ${companyName}`,
            tenantId: result.tenant.id,
            userId: result.user.id
        });

        // サインアップ後にログインセッションを返す
        const tempClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
            auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data: signInData, error: signInError } = await tempClient.auth.signInWithPassword({
            email,
            password,
        });

        // 有料プランの場合はStripeセッションを作成
        let checkoutUrl = null;
        if (plan && plan !== 'free') {
            const { stripe, PLAN_CONFIG } = require('../config/stripe');
            const planConfig = PLAN_CONFIG[plan];
            
            if (planConfig && planConfig.priceId) {
                const session = await stripe.checkout.sessions.create({
                    mode: 'subscription',
                    payment_method_types: ['card'],
                    line_items: [{ price: planConfig.priceId, quantity: 1 }],
                    success_url: `${process.env.APP_URL}/admin?tab=billing&success=true`,
                    cancel_url: `${process.env.APP_URL}/admin?tab=billing&canceled=true`,
                    metadata: {
                        type: 'subscription',
                        tenant_id: result.tenant.id,
                        plan: plan,
                    },
                    subscription_data: {
                        metadata: {
                            tenant_id: result.tenant.id,
                            plan: plan,
                        }
                    },
                    customer_email: email,
                });
                checkoutUrl = session.url;
            }
        }

        res.status(201).json({
            message: 'Account created successfully',
            tenant: result.tenant,
            user: result.user,
            session: signInError ? null : signInData.session,
            checkoutUrl, // 決済画面のURLを返す
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/auth/login
 * ログイン
 */
router.post('/login', async (req, res, next) => {
    console.log(`\n[Auth/Login DEBUG] --- New Login Request ---`);
    console.log(`[Auth/Login DEBUG] Origin: ${req.headers.origin}`);
    console.log(`[Auth/Login DEBUG] Body: ${JSON.stringify({ ...req.body, password: '***' })}`);
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new AppError('Email and password are required', 400, 'VALIDATION_ERROR');
        }

        const tempClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
            auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data, error } = await tempClient.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
        }

        // ユーザーの有効状態とロールをDBでチェック
        // まず platform_admins (SU) をチェック
        const { data: platformAdmin } = await supabaseAdmin
            .from('platform_admins')
            .select('*')
            .eq('id', data.user.id)
            .single();

        let userRole = data.user.app_metadata?.role || 'user';
        let userName = '';

        if (platformAdmin) {
            userRole = 'super_admin';
            userName = platformAdmin.name || 'Platform Admin';
        } else {
            const { data: userProfile } = await supabaseAdmin
                .from('users')
                .select('is_active, name, role')
                .eq('id', data.user.id)
                .single();

            if (userProfile && !userProfile.is_active) {
                throw new AppError('Account is deactivated', 403, 'ACCOUNT_DEACTIVATED');
            }
            if (userProfile) {
                userRole = userProfile.role;
                userName = userProfile.name;
            }
        }

        // HotFolderからのログイン時は権限チェックを実施
        const clientType = req.body.clientType || 'web';
        if (clientType === 'hotfolder') {
            if (userRole !== 'system_admin' && userRole !== 'admin') {
                console.log(`[Auth/Login] Blocked hotfolder login for user ${email} with role ${userRole}`);
                throw new AppError('案件登録する権限がありません。システム管理者に確認してください。', 403, 'INSUFFICIENT_PERMISSIONS');
            }
        }

        // 多重ログイン制御: 現在のsession_idをapp_metadataに記録
        let sessionId = null;
        try {
            const token = data.session?.access_token;
            if (token) {
                const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf-8'));
                sessionId = payload.session_id;
            }
        } catch (e) {
            console.error('[Auth/Login] Failed to parse session_id:', e.message);
        }

        if (sessionId) {
            const updateField = clientType === 'hotfolder' ? 'active_hotfolder_session_id' : 'active_session_id';

            // 最新のユーザー情報を取得して metadata の競合を避ける
            const { data: latestUser } = await supabaseAdmin.auth.admin.getUserById(data.user.id);
            const currentMetadata = latestUser?.user?.app_metadata || {};

            console.log(`[Auth/Login] Updating session for ${clientType}. Current metadata:`, currentMetadata);

            await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
                app_metadata: {
                    ...currentMetadata,
                    [updateField]: sessionId,
                    role: userRole // メタデータのロールも同期させる
                }
            });
            console.log(`[Auth/Login] Registered new ${clientType} session for user ${data.user.id}: ${sessionId}`);
        }

        res.json({
            user: {
                id: data.user.id,
                email: data.user.email,
                name: userName || '',
                role: userRole,
                tenantId: userRole === 'super_admin' ? null : data.user.app_metadata?.tenant_id,
            },
            session: data.session,
        });

        await logService.audit({
            action: 'login_success',
            entityType: 'auth',
            description: `ログイン成功: ${email}`,
            tenantId: userRole === 'super_admin' ? null : data.user.app_metadata?.tenant_id,
            userId: data.user.id
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/auth/login-with-code
 * 従業員用ログイン（会社コード＋従業員番号）
 */
router.post('/login-with-code', async (req, res, next) => {
    try {
        const { companyCode, employeeId, password } = req.body;

        if (!companyCode || !employeeId || !password) {
            throw new AppError('Company code, employee ID and password are required', 400, 'VALIDATION_ERROR');
        }

        // 会社コード（slug）からダミーメールを組み立てる
        // ※実際には slug が存在するかチェックしても良いが、signInWithPassword が失敗してくれるのでOK
        const email = `${employeeId}@${companyCode}.aizumen.local`;

        const tempClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
            auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data, error } = await tempClient.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            throw new AppError('Invalid credentials or deactivated account', 401, 'INVALID_CREDENTIALS');
        }

        // ユーザーがアクティブかチェック
        const { data: userProfile } = await supabaseAdmin
            .from('users')
            .select('is_active, name, role')
            .eq('id', data.user.id)
            .single();

        if (userProfile && !userProfile.is_active) {
            throw new AppError('Account is deactivated', 403, 'ACCOUNT_DEACTIVATED');
        }

        // HotFolderからのログイン時は権限チェックを実施
        const clientType = req.body.clientType || 'web';
        const userRole = data.user.app_metadata?.role || 'user';
        if (clientType === 'hotfolder') {
            if (userRole !== 'system_admin' && userRole !== 'admin') {
                console.log(`[Auth/LoginWithCode] Blocked hotfolder login for user ${email} with role ${userRole}`);
                throw new AppError('案件登録する権限がありません。システム管理者に確認してください。', 403, 'INSUFFICIENT_PERMISSIONS');
            }
        }

        // 多重ログイン制御: 現在のsession_idをapp_metadataに記録
        let sessionId = null;
        try {
            const token = data.session?.access_token;
            if (token) {
                const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf-8'));
                sessionId = payload.session_id;
            }
        } catch (e) {
            console.error('[Auth/LoginWithCode] Failed to parse session_id:', e.message);
        }

        if (sessionId) {
            const clientType = req.body.clientType;
            const updateField = clientType === 'hotfolder' ? 'active_hotfolder_session_id' : 'active_session_id';

            // 最新のユーザー情報を取得
            const { data: latestUser } = await supabaseAdmin.auth.admin.getUserById(data.user.id);
            const currentMetadata = latestUser?.user?.app_metadata || {};

            await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
                app_metadata: {
                    ...currentMetadata,
                    [updateField]: sessionId
                }
            });
            console.log(`[Auth/LoginWithCode] Registered new ${clientType || 'web'} session for user ${data.user.id}: ${sessionId}`);
        }

        res.json({
            user: {
                id: data.user.id,
                email: data.user.email,
                name: userProfile?.name || '',
                role: data.user.app_metadata?.role || 'user',
                tenantId: data.user.app_metadata?.tenant_id,
            },
            session: data.session,
        });

        await logService.audit({
            action: 'login_success',
            entityType: 'auth',
            description: `ログイン成功（従業員番号）: ${employeeId}@${companyCode}`,
            tenantId: data.user.app_metadata?.tenant_id,
            userId: data.user.id
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/auth/logout
 * ログアウト（トークン無効化）
 */
router.post('/logout', authMiddleware, async (req, res, next) => {
    try {
        // サーバーサイドでのセッション無効化は Supabase Auth が管理
        await logService.audit({
            action: 'logout',
            entityType: 'auth',
            description: `ログアウト`,
            tenantId: req.tenantId,
            userId: req.userId
        });
        res.json({ message: 'Logged out successfully' });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/auth/reset-password
 * パスワードリセット要求
 */
router.post('/reset-password', async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            throw new AppError('Email is required', 400, 'VALIDATION_ERROR');
        }

        const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
            redirectTo: `${process.env.APP_URL}/update-password`,
        });

        if (error) {
            console.error('[Auth] Password reset error:', error.message);
        }

        // セキュリティ：メールが存在するかどうかに関わらず同じレスポンス
        res.json({ message: 'If the email exists, a reset link has been sent' });
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /api/auth/update-password
 * パスワード更新
 */
router.put('/update-password', authMiddleware, async (req, res, next) => {
    try {
        const { password } = req.body;
        if (!password || password.length < 8) {
            throw new AppError('Password must be at least 8 characters', 400, 'VALIDATION_ERROR');
        }

        const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
            password,
        });

        if (error) {
            throw new AppError('Failed to update password', 500, 'PASSWORD_UPDATE_FAILED');
        }

        await logService.audit({
            action: 'password_updated',
            entityType: 'user',
            entityId: req.user.id,
            description: `パスワード更新（本人による）`,
            tenantId: req.tenantId,
            userId: req.userId
        });

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/auth/me
 * 現在のユーザー情報取得
 */
router.get('/me', authMiddleware, async (req, res, next) => {
    try {
        // まず platform_admins (SU) をチェック（メタデータに頼らずDBを正解とする）
        const { data: platformAdmin } = await supabaseAdmin
            .from('platform_admins')
            .select('*')
            .eq('id', req.user.id)
            .single();

        if (platformAdmin) {
            return res.json({
                user: {
                    id: req.user.id,
                    email: req.user.email,
                    name: platformAdmin.name || 'Platform Admin',
                    role: 'super_admin',
                    is_active: true,
                },
                tenant: {
                    id: 'platform',
                    name: 'AiZumen Platform',
                    plan: 'enterprise',
                },
            });
        }

        let { data: profile, error } = await supabaseAdmin
            .from('users')
            .select('id, email, name, role, is_active, created_at')
            .eq('id', req.user.id)
            .single();

        if (error || !profile) {
            console.log('[Auth/Me] Profile missing. Attempting self-healing...');
            // プロフィールがない場合は作成
            const { data: newProfile, error: insertError } = await supabaseAdmin
                .from('users')
                .insert({
                    id: req.user.id,
                    tenant_id: req.tenantId,
                    email: req.user.email,
                    name: req.user.user_metadata?.name || 'User',
                    role: req.userRole || 'user'
                })
                .select()
                .single();

            if (insertError) {
                console.error('[Auth/Me] Self-healing failed:', insertError);
                throw new AppError('User profile not found and could not be created', 404, 'PROFILE_NOT_FOUND');
            }
            profile = newProfile;
        }

        console.log('[Auth/Me] Fetching tenant for ID:', req.tenantId);
        const { data: tenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .select('id, name, slug, plan, hourly_rate, zip, fax, email, address, phone, website, trial_ends_at')
            .eq('id', req.tenantId)
            .single();

        if (tenantError) {
            console.error('[Auth/Me] Error fetching tenant:', tenantError);
        }
        console.log('[Auth/Me] Fetched tenant:', tenant);

        const { data: subscription } = await supabaseAdmin
            .from('subscriptions')
            .select('status, current_period_end, cancel_at_period_end')
            .eq('tenant_id', req.tenantId)
            .maybeSingle();

        // ストレージ使用量取得
        const { data: usageData } = await supabaseAdmin
            .from('quotation_files')
            .select('file_size')
            .eq('tenant_id', req.tenantId);

        const storageUsage = usageData?.reduce((sum, f) => sum + (f.file_size || 0), 0) || 0;
        const maxStorageGB = PLAN_CONFIG[tenant?.plan]?.maxStorageGB || 1;

        // 自己修復ロジック: ステータスが active または past_due でも、期限（current_period_end）が過ぎていれば
        // stripe 側の同期を待たずに DB 上で明示的に canceled 扱いにする
        if (subscription && (subscription.status === 'active' || subscription.status === 'past_due')) {
            if (subscription.current_period_end && new Date(subscription.current_period_end) < new Date()) {
                console.log(`[Auth/Me] Self-healing: Subscription for tenant ${req.tenantId} has expired. Updating DB...`);

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

                // 返却するオブジェクトも更新
                subscription.status = 'canceled';
                if (tenant) tenant.plan = 'free';
            }
        }

        res.json({
            user: profile,
            tenant,
            subscription: {
                ...subscription,
                storageUsage,
                maxStorageGB
            },
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/auth/report-error
 * フロントエンドからのエラー報告を受け取る
 */
router.post('/report-error', async (req, res, next) => {
    try {
        const { message, stack, browserInfo, path, level } = req.body;

        // 非ログイン時でも受け取る（authMiddlewareは通さない）
        // ただし tenantId, userId はトークンがあれば取得を試みる
        let userId = null;
        let tenantId = null;

        // BearerトークンがあればパースしてIDを特定（簡易的）
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                // ここではデコードのみ（検証は省略して利便性優先）
                const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                userId = payload.sub;
                tenantId = payload.app_metadata?.tenant_id;
            } catch (e) { /* ignore */ }
        }

        await logService.error({
            message: message || 'Frontend Error',
            stack,
            source: 'client',
            level: level || 'error',
            tenantId,
            userId,
            path,
            browserInfo
        });

        res.status(204).end();
    } catch (err) {
        // ログ保存失敗自体でAPIエラーにはしたくない
        res.status(204).end();
    }
});

module.exports = router;
