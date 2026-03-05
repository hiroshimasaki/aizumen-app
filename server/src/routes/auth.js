const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { supabaseAdmin } = require('../config/supabase');
const authService = require('../services/authService');
const { authMiddleware } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

/**
 * POST /api/auth/signup
 * テナント + 管理者アカウント作成
 */
router.post('/signup', async (req, res, next) => {
    try {
        const { email, password, userName, companyName, companyCode, plan } = req.body;
        const result = await authService.signUp({ email, password, userName, companyName, companyCode, plan });

        // サインアップ後にログインセッションを返す
        const tempClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
            auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data: signInData, error: signInError } = await tempClient.auth.signInWithPassword({
            email,
            password,
        });

        res.status(201).json({
            message: 'Account created successfully',
            tenant: result.tenant,
            user: result.user,
            session: signInError ? null : signInData.session,
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

        // ユーザーがアクティブかチェック
        const { data: userProfile } = await supabaseAdmin
            .from('users')
            .select('is_active, name, role')
            .eq('id', data.user.id)
            .single();

        if (userProfile && !userProfile.is_active) {
            throw new AppError('Account is deactivated', 403, 'ACCOUNT_DEACTIVATED');
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
            await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
                app_metadata: {
                    ...data.user.app_metadata,
                    active_session_id: sessionId
                }
            });
            console.log(`[Auth/Login] Registered new session for user ${data.user.id}: ${sessionId}`);
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
            await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
                app_metadata: {
                    ...data.user.app_metadata,
                    active_session_id: sessionId
                }
            });
            console.log(`[Auth/LoginWithCode] Registered new session for user ${data.user.id}: ${sessionId}`);
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
        // Super Admin (SU) の場合は専用のレスポンスを返す
        if (req.userRole === 'super_admin') {
            const { data: platformAdmin } = await supabaseAdmin
                .from('platform_admins')
                .select('*')
                .eq('id', req.user.id)
                .single();

            return res.json({
                user: {
                    id: req.user.id,
                    email: req.user.email,
                    name: platformAdmin?.name || 'Platform Admin',
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

        res.json({
            user: profile,
            tenant,
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
