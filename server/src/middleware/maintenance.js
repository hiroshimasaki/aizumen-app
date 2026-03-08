const { supabaseAdmin } = require('../config/supabase');

/**
 * メンテナンスモードを確認するミドルウェア
 */
const maintenanceMiddleware = async (req, res, next) => {
    // 公開パス（認証不要・状態確認用）
    const publicPaths = [
        '/api/sys/status',
        '/api/health',
        '/api/webhook',
        '/api/auth/report-error',
        '/api/auth/login' // SUがログインしてメンテナンス解除できるようにするため
    ];

    // 管理者操作パス（メンテナンス中も許可）
    const superAdminPaths = [
        '/api/super-admin'
    ];

    // 公開パスは常に許可
    if (publicPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    // 管理者パスも常に許可（内部で権限チェックがあるため）
    if (superAdminPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    // 注意: /api/auth はここに含まれないため、一般ユーザーの /api/auth/me などはメンテナンス時に 503 になる

    try {
        // 設定をキャッシュせず、都度最新の状態を確認（運用上の即時性重視）
        const { data, error } = await supabaseAdmin
            .from('system_settings')
            .select('value')
            .eq('key', 'maintenance_mode')
            .maybeSingle();

        if (error) {
            console.error('[MaintenanceMiddleware] Error fetching settings:', error.message);
            return next(); // DBエラー時はサービス継続を優先
        }

        const settings = data?.value || { enabled: false, message: '' };

        if (settings.enabled) {
            // トークンから platform_admin 権限を確認（ログイン済みの場合のみ）
            let isSuperAdmin = false;
            const authHeader = req.headers.authorization;
            
            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const token = authHeader.replace('Bearer ', '');
                    const payloadBase64 = token.split('.')[1];
                    if (payloadBase64) {
                        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
                        const userId = payload.sub;
                        const role = payload.app_metadata?.role;
                        
                        // JWTのクレームにroleがあればそれを優先
                        if (role === 'super_admin' || role === 'platform_admin') {
                            isSuperAdmin = true;
                        } else if (userId) {
                            // なければDB(platform_admins)から確認
                            const { data: adminUser } = await supabaseAdmin
                                .from('platform_admins')
                                .select('id')
                                .eq('id', userId)
                                .maybeSingle();
                            if (adminUser) isSuperAdmin = true;
                        }
                    }
                } catch (e) {
                    console.error('[MaintenanceMiddleware] Token decode error:', e.message);
                }
            }

            if (isSuperAdmin) {
                return next();
            }

            return res.status(503).json({
                error: 'Service Unavailable',
                maintenance: true,
                message: settings.message || '現在システムメンテナンス中です。終了までしばらくお待ちください。',
                startedAt: settings.started_at
            });
        }

        next();
    } catch (err) {
        console.error('[MaintenanceMiddleware] Unexpected error:', err.message);
        next();
    }
};

module.exports = maintenanceMiddleware;
