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
    // ログ出力
    console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: err.isOperational ? 'warn' : 'error',
        message: err.message,
        code: err.code,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
        tenantId: req.tenantId || null,
        userId: req.user?.id || null,
        stack: err.isOperational ? undefined : err.stack,
    }));

    // 運用上の予期されたエラー
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            error: err.message,
            code: err.code,
        });
    }

    // 予期しないエラー（バグ）
    // クライアントには詳細を見せない
    try {
        const fs = require('fs');
        const path = require('path');
        const logPath = path.join(__dirname, '../../error.log');
        const errorDetails = err ? (err.stack || err.message || String(err)) : 'Unknown Error';
        fs.appendFileSync(logPath, `${new Date().toISOString()} - FATAL ERROR: ${errorDetails}\n\n`);
    } catch (e) {
        // failed to write log
    }

    res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
    });
};

module.exports = { AppError, errorHandler };
