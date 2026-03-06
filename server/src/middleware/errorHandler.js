const logService = require('../services/logService');

/**
 * カスタムエラークラス
 * isOperational = true のエラーはクライアントにメッセージを返す（予期されたエラー）
 */
class AppError extends Error {
    constructor(message, statusCode, code = 'ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
    }
}

/**
 * グローバルエラーハンドリングミドルウェア
 */
const errorHandler = (err, req, res, _next) => {
    // 構造化ログ出力（標準出力）
    const errorLog = {
        timestamp: new Date().toISOString(),
        level: err.isOperational ? 'warn' : 'error',
        message: err.message,
        code: err.code,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
        tenantId: req.tenantId || null,
        userId: req.user?.id || req.session?.user?.id || null,
        stack: err.isOperational ? undefined : err.stack,
    };
    console.error(JSON.stringify(errorLog));

    // DBへの永続化ログ
    // 非同期で実行（レスポンスを待たせない）助。
    logService.error({
        message: err.message,
        stack: err.isOperational ? null : err.stack,
        source: 'server',
        level: err.isOperational ? 'warn' : 'error',
        tenantId: errorLog.tenantId,
        userId: errorLog.userId,
        path: req.path,
        method: req.method
    });

    // 運用上の予期されたエラー
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            error: err.message,
            code: err.code,
        });
    }

    // 予期しないエラー（バグ）の場合は 500
    res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
    });
};

module.exports = { AppError, errorHandler };
