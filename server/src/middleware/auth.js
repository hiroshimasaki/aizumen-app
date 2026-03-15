const { supabaseAdmin } = require('../config/supabase');
const logService = require('../services/logService');

/**
 * JWT認証ミドルウェア
 * Authorization ヘッダーからトークンを取得し、Supabase Authで検証。
 * req.user, req.tenantId, req.userRole, req.accessToken を設定。
 */
const authMiddleware = async (req, res, next) => {
    logService.debug('Auth Middleware checking request', {
        method: req.method,
        url: req.originalUrl,
        hasAuthHeader: !!req.headers.authorization
    });
    
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logService.warn('Missing or invalid Authorization header', { path: req.originalUrl });
            return res.status(401).json({ error: 'Authorization token required' });
        }

        const token = authHeader.replace('Bearer ', '');
        logService.debug('Auth: Token received');

        // トークン検証用に一時的なクライアントを作成
        const { createUserClient } = require('../config/supabase');
        const userClient = createUserClient(token);
        const { data: { user }, error } = await userClient.auth.getUser();

        if (error || !user) {
            logService.warn('Supabase auth.getUser failed', { 
                error: error?.message, 
                token: token.substring(0, 10) + '...' // 失敗時のみ限定的に記録
            });
            
            // デバッグ用：トークンのペイロードをデコードして内容を確認 (開発時のみ)
            if (process.env.NODE_ENV === 'development') {
                try {
                    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf-8'));
                    logService.debug('Failed token payload', payload);
                } catch (e) { /* ignore */ }
            }

            return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
        }

        logService.debug('User verified from Supabase', { userId: user.id, email: user.email });

        // ユーザーの有効状態とロールをDBで強制チェック
        // まず platform_admins (SU) をチェック
        const { data: platformAdmin } = await supabaseAdmin
            .from('platform_admins')
            .select('*')
            .eq('id', user.id)
            .single();

        let profile = null;
        let role = null;

        if (platformAdmin) {
            role = 'super_admin';
        } else {
            // 一般ユーザーをチェック
            const { data: userProfile, error: dbError } = await supabaseAdmin
                .from('users')
                .select('is_active, role, tenant_id')
                .eq('id', user.id)
                .single();

            if (dbError || !userProfile) {
                logService.info('Profile missing in DB, falling back to metadata', { userId: user.id });
                role = user.app_metadata?.role || 'user';
                profile = {
                    tenant_id: user.app_metadata?.tenant_id || null,
                    is_active: true
                };
            } else {
                if (userProfile.is_active === false) {
                    logService.warn('Access denied for deactivated user', { userId: user.id });
                    return res.status(401).json({ error: 'Account is deactivated', code: 'USER_DEACTIVATED' });
                }

                profile = userProfile;
                role = userProfile.role;
            }
        }

        // JWTのペイロードをデコードして session_id と aal を取得
        let currentSessionId = null;
        let aal = 'aal1';
        try {
            const payloadBase64 = token.split('.')[1];
            if (payloadBase64) {
                const decodedPayload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
                currentSessionId = decodedPayload.session_id;
                aal = decodedPayload.aal || 'aal1';
            }
        } catch (e) {
            console.error('[Auth Middleware] Failed to decode JWT payload:', e.message);
        }

        const clientType = req.headers['x-client-type'] || 'web';
        const activeSessionField = clientType === 'hotfolder' ? 'active_hotfolder_session_id' : 'active_session_id';
        let activeSessionId = user.app_metadata?.[activeSessionField];

        if (activeSessionId && currentSessionId && activeSessionId !== currentSessionId) {
            logService.info('Session mismatch, refreshing from Supabase Auth admin', { userId: user.id });
            const { data: latestUserData } = await supabaseAdmin.auth.admin.getUserById(user.id);
            activeSessionId = latestUserData?.user?.app_metadata?.[activeSessionField];
        }

        if (activeSessionId && currentSessionId && activeSessionId !== currentSessionId) {
            logService.warn('Multi-login detected', { userId: user.id, clientType });
            return res.status(401).json({ 
                error: 'Logged in from another device', 
                code: 'MULTI_LOGIN',
                details: 'This account is currently in use on another device.'
            });
        }
        // リクエストにユーザー情報を付加
        req.user = user;
        req.userId = user.id;
        req.userRole = role || 'user';
        req.tenantId = (role === 'super_admin') ? 'platform' : (profile?.tenant_id || null);
        req.accessToken = token;
        req.aal = aal;

        // app_metadata のロールを上書き（互換性のため）
        if (req.user.app_metadata) {
            req.user.app_metadata.role = req.userRole;
        }

        next();
    } catch (err) {
        console.error('[Auth Middleware] Error:', err.message);
        return res.status(401).json({ error: 'Authentication failed' });
    }
};

/**
 * ロールチェックミドルウェア
 * 指定されたロールのいずれかを持つユーザーのみアクセスを許可。
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        // system_admin と super_admin は常に許可
        if (req.userRole === 'system_admin' || req.userRole === 'super_admin') {
            return next();
        }
        if (!roles.includes(req.userRole)) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                required: roles,
                current: req.userRole,
            });
        }
        next();
    };
};

/**
 * MFA認証チェックミドルウェア
 * SU権限などの機密操作に対し、MFA認証（TOTP等）が完了していることを要求する。
 */
const requireMFA = async (req, res, next) => {
    try {
        // aal2 (MFA完了済み) かどうかをチェック
        if (req.aal !== 'aal2') {
            console.log(`[MFA Middleware] MFA required but current level is ${req.aal}`);
            return res.status(403).json({
                error: 'MFA verification required',
                code: 'MFA_VERIFICATION_REQUIRED'
            });
        }

        next();
    } catch (err) {
        console.error('[MFA Middleware] Error:', err.message);
        res.status(500).json({ error: 'MFA verification failed' });
    }
};

module.exports = { authMiddleware, requireRole, requireMFA };
