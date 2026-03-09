const { supabaseAdmin } = require('../config/supabase');

/**
 * ログ管理サービス
 * エラー、アクセス、監査ログを Supabase に保存します。
 */
class LogService {
    /**
     * エラーログを記録
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
            console.error('[LogService] Failed to write error log:', err.message);
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
            console.error('[LogService] Failed to write access log:', err.message);
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
                metadata,
                tenant_id: tenantId,
                user_id: userId
            });
        } catch (err) {
            console.error('[LogService] Failed to write audit log:', err.message);
        }
    }

    /**
     * デバッグログをローカルファイルに記録
     */
    async debug(message, metadata = null) {
        try {
            const fs = require('fs');
            const path = require('path');
            const logDir = path.join(process.cwd(), 'logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir);
            }
            const logFile = path.join(logDir, 'debug.log');
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] ${message} ${metadata ? JSON.stringify(metadata) : ''}\n`;
            fs.appendFileSync(logFile, logEntry);
            console.log(`[Debug] ${message}`);
        } catch (err) {
            console.error('[LogService] Failed to write debug log to file:', err.message);
        }
    }
}

module.exports = new LogService();
