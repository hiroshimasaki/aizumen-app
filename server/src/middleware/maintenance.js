const { supabaseAdmin } = require('../config/supabase');

/**
 * メンテナンスモードを確認するミドルウェア
 */
const maintenanceMiddleware = async (req, res, next) => {
    // 公開パスやプラットフォーム管理用パスはスキップ（再帰ループ防止・SUログイン確保）
    const skipPaths = [
        '/api/auth',
        '/api/health',
        '/api/super-admin', // 管理者操作は常に許可（トグルOFFできなくなるのを防ぐ）
        '/api/webhook' // Stripe等の外部連携
    ];

    if (skipPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    try {
        // 設定をキャッシュせず、都度最新の状態を確認（運用上の即時性重視）
        const { data, error } = await supabaseAdmin
            .from('system_settings')
            .select('value')
            .eq('key', 'maintenance_mode')
            .single();

        if (error) {
            console.error('[MaintenanceMiddleware] Error fetching settings:', error.message);
            return next(); // DBエラー時はサービス継続を優先（または安全側に倒すか検討）
        }

        const settings = data?.value || {};

        if (settings.enabled) {
            // トークンから platform_admin 権限を確認（ログイン済みの場合のみ）
            // authMiddleware の前で実行される可能性があるため、自前で最小限のチェックを行うか、
            // authMiddleware の後に配置する構成にする。
            // ここでは「権限があればスキップ」のロジックを入れる。
            
            // 注意: このミドルウェアは認証系ミドルウェアの後、または
            // トークンをデコードできる状態で動かす必要がある。
            const userRole = req.user?.role;
            if (userRole === 'platform_admin' || userRole === 'super_admin') {
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
