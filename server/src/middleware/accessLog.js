const logService = require('../services/logService');

/**
 * アクセスログ記録用ミドルウェア
 */
const accessLogMiddleware = (req, res, next) => {
    const start = Date.now();

    // 応答が完了したときにログを出力
    res.on('finish', () => {
        const durationMs = Date.now() - start;

        // ヘルスチェックや静的ファイルのリクエストなどは除外（必要に応じて）
        if (req.path === '/api/health') return;

        // 非同期でログを書き込み。エラーハンドリングは logService 内で行われる。
        logService.access({
            path: req.path,
            method: req.method,
            statusCode: res.statusCode,
            durationMs: durationMs,
            tenantId: req.tenantId || null,
            userId: req.user?.id || req.session?.user?.id || null,
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
        });
    });

    next();
};

module.exports = accessLogMiddleware;
