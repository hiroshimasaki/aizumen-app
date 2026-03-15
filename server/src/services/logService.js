const { supabaseAdmin } = require('../config/supabase');

/**
 * ログ管理サービス
 * エラー、アクセス、監査ログを Supabase に保存し、
 * コンソールへのレベル別出力（マスキング対応）を提供します。
 */
class LogService {
    constructor() {
        this.sensitiveKeys = ['token', 'password', 'key', 'secret', 'authorization', 'email', 'sig', 'signature'];
        this.isDev = process.env.NODE_ENV === 'development';
    }

    /**
     * 機密情報をマスクしたオブジェクトを返す
     */
    maskSensitiveData(data) {
        if (!data || typeof data !== 'object') return data;
        
        const masked = Array.isArray(data) ? [] : {};
        
        for (const [key, value] of Object.entries(data)) {
            if (this.sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
                masked[key] = '***';
            } else if (typeof value === 'object' && value !== null) {
                masked[key] = this.maskSensitiveData(value);
            } else {
                masked[key] = value;
            }
        }
        return masked;
    }

    /**
     * コンソール出力の共通処理
     */
    _log(level, message, metadata = null) {
        const timestamp = new Date().toISOString();
        const levelLabel = `[${level.toUpperCase()}]`;
        const maskedMetadata = metadata ? this.maskSensitiveData(metadata) : null;
        
        const output = `[AiZumen API]${levelLabel}[${timestamp}] ${message}`;
        
        if (level === 'error') {
            console.error(output, maskedMetadata || '');
        } else if (level === 'warn') {
            console.warn(output, maskedMetadata || '');
        } else {
            console.log(output, maskedMetadata || '');
        }
    }

    /**
     * 情報ログ（本番でも出力）
     */
    info(message, metadata = null) {
        this._log('info', message, metadata);
    }

    /**
     * 警告ログ（本番でも出力）
     */
    warn(message, metadata = null) {
        this._log('warn', message, metadata);
    }

    /**
     * デバッグログ（開発環境のみ出力）
     */
    debug(message, metadata = null) {
        if (this.isDev) {
            this._log('debug', message, metadata);
        }
    }

    /**
     * エラーログを記録 (Supabase + Console)
     */
    async error({
        message,
        stack = null,
        source = 'server',
        level = 'error',
        tenantId = null,
        userId = null,
        path = null,
        method = null,
        browserInfo = null
    }) {
        // コンソール出力
        this._log('error', message, { stack, source, path, method });

        try {
            await supabaseAdmin.from('system_error_logs').insert({
                message,
                stack,
                source,
                level,
                tenant_id: tenantId,
                user_id: userId,
                path,
                method,
                browser_info: browserInfo
            });
        } catch (err) {
            console.error('[LogService] Failed to write error log to DB:', err.message);
        }
    }

    /**
     * アクセスログを記録
     */
    async access({
        path,
        method,
        statusCode,
        durationMs,
        tenantId = null,
        userId = null,
        ip = null
    }) {
        try {
            await supabaseAdmin.from('system_access_logs').insert({
                path,
                method,
                status_code: statusCode,
                duration_ms: durationMs,
                tenant_id: tenantId,
                user_id: userId,
                ip
            });
        } catch (err) {
            // アクセスログの失敗は頻出するため、サイレントに失敗するか、最小限の警告に留める
            if (this.isDev) console.warn('[LogService] Failed to write access log to DB');
        }
    }

    /**
     * 監査ログ（業務アクション）を記録
     */
    async audit({
        action,
        entityType,
        entityId = null,
        description = null,
        metadata = null,
        tenantId = null,
        userId = null
    }) {
        try {
            await supabaseAdmin.from('audit_logs').insert({
                action,
                entity_type: entityType,
                entity_id: entityId?.toString(),
                description,
                metadata: this.maskSensitiveData(metadata),
                tenant_id: tenantId,
                user_id: userId
            });
        } catch (err) {
            console.error('[LogService] Failed to write audit log to DB:', err.message);
        }
    }

    /**
     * 詳細デバッグログをローカルファイルに記録
     */
    async writeDebugFile(message, metadata = null) {
        if (!this.isDev) return;

        try {
            const fs = require('fs');
            const path = require('path');
            const logDir = path.join(process.cwd(), 'logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir);
            }
            const logFile = path.join(logDir, 'debug.log');
            const timestamp = new Date().toISOString();
            const maskedMetadata = this.maskSensitiveData(metadata);
            const logEntry = `[${timestamp}] ${message} ${maskedMetadata ? JSON.stringify(maskedMetadata) : ''}\n`;
            fs.appendFileSync(logFile, logEntry);
        } catch (err) {
            console.error('[LogService] Failed to write debug log to file:', err.message);
        }
    }
}

module.exports = new LogService();
