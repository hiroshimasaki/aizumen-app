const { supabaseAdmin } = require('../config/supabase');

/**
 * JWT認証ミドルウェア
 * Authorization ヘッダーからトークンを取得し、Supabase Authで検証。
 * req.user, req.tenantId, req.userRole, req.accessToken を設定。
 */
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization token required' });
        }

        const token = authHeader.replace('Bearer ', '');

        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

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
                return res.status(401).json({ error: 'User profile not found' });
            }

            if (userProfile.is_active === false) {
                console.log(`[Auth Middleware] Access denied for deactivated user: ${user.id}`);
                return res.status(401).json({ error: 'Account is deactivated', code: 'USER_DEACTIVATED' });
            }

            profile = userProfile;
            role = userProfile.role;
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

        const activeSessionId = user.app_metadata?.active_session_id;

        // アクティブセッションIDが登録されており、かつ現在のセッションIDと異なる場合は別端末ログイン扱い
        if (activeSessionId && currentSessionId && activeSessionId !== currentSessionId) {
            console.log(`[Auth Middleware] Multi-login detected for user ${user.id}. Active: ${activeSessionId}, Current: ${currentSessionId}`);
            return res.status(401).json({ error: 'Logged in from another device', code: 'MULTI_LOGIN' });
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
        // system_admin は常に許可
        if (req.userRole === 'system_admin') {
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
