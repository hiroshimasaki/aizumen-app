const { supabaseAdmin } = require('../config/supabase');

async function runDailyBackup() {
    console.log('[BackupService] Starting daily backup...');
    // アクティブな全テナントのIDとプランを取得
    const { data: tenants, error: tenantsError } = await supabaseAdmin.from('tenants').select('id, plan');
    if (tenantsError) {
        console.error('[BackupService] Failed to fetch tenants:', tenantsError);
        return;
    }

    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    for (const tenant of tenants) {
        try {
            // データ取得
            const { data, error } = await supabaseAdmin
                .from('quotations')
                .select('*, quotation_items(*)')
                .eq('tenant_id', tenant.id)
                .eq('is_deleted', false)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (!data || data.length === 0) continue;

            const jsonData = JSON.stringify(data);
            const fileName = `backups/${tenant.id}/backup_${timestamp}.json`;

            // Storageにアップロード (upsert: true で同日の再実行を上書き)
            const { error: uploadError } = await supabaseAdmin.storage
                .from('quotation-files')
                .upload(fileName, Buffer.from(jsonData, 'utf8'), {
                    contentType: 'application/pdf',
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            // 契約プランに応じた期間で古いバックアップを削除
            await cleanOldBackups(tenant.id, tenant.plan);

        } catch (err) {
            console.error(`[BackupService] Failed backup for tenant ${tenant.id}:`, err);
        }
    }
    console.log('[BackupService] Daily backup completed.');
}

async function listBackups(tenantId) {
    const { data, error } = await supabaseAdmin.storage
        .from('quotation-files')
        .list(`backups/${tenantId}`, {
            limit: 100,
            sortBy: { column: 'created_at', order: 'desc' },
        });

    if (error) throw error;
    // ファイルのみフィルタリング
    return data.filter(f => f.name.endsWith('.json'));
}

async function getBackupFileUrl(tenantId, fileName) {
    const { data, error } = await supabaseAdmin.storage
        .from('quotation-files')
        .createSignedUrl(`backups/${tenantId}/${fileName}`, 3600); // 1時間有効

    if (error) throw error;
    return data.signedUrl;
}

// 30日以上古いバックアップを削除
async function cleanOldBackups(tenantId, plan = 'lite') {
    try {
        const files = await listBackups(tenantId);
        const now = new Date();

        // プランに応じて保持日数を決定 (pro: 30日, その他: 7日)
        const retentionDays = plan === 'pro' ? 30 : 7;

        const TO_DELETE = files.filter(f => {
            const fileDate = new Date(f.created_at);
            const diffDays = (now - fileDate) / (1000 * 60 * 60 * 24);
            return diffDays > retentionDays;
        });

        if (TO_DELETE.length > 0) {
            const paths = TO_DELETE.map(f => `backups/${tenantId}/${f.name}`);
            await supabaseAdmin.storage.from('quotation-files').remove(paths);
            console.log(`[BackupService] Removed ${paths.length} old backups for tenant ${tenantId}`);
        }
    } catch (err) {
        console.error(`[BackupService] Failed to clean old backups for tenant ${tenantId}:`, err);
    }
}

// 特定テナントのみのバックアップ実行
async function runTenantBackup(tenantId) {
    const timestamp = new Date().toISOString().split('T')[0] + '_' + Math.floor(Date.now() / 1000); // 手動時はタイムスタンプ付き

    const { data, error } = await supabaseAdmin
        .from('quotations')
        .select('*, quotation_items(*)')
        .eq('tenant_id', tenantId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) return { message: 'データがありません' };

    const jsonData = JSON.stringify(data);
    const fileName = `backups/${tenantId}/manual_backup_${timestamp}.json`;

    const { error: uploadError } = await supabaseAdmin.storage
        .from('quotation-files')
        .upload(fileName, Buffer.from(jsonData, 'utf8'), {
            contentType: 'application/pdf',
            upsert: true,
        });

    if (uploadError) throw uploadError;

    // 手動実行後もクリーンアップを実行（プラン情報を取得して渡す）
    const { data: tenant } = await supabaseAdmin.from('tenants').select('plan').eq('id', tenantId).single();
    if (tenant) {
        await cleanOldBackups(tenantId, tenant.plan);
    }

    return { message: 'バックアップを作成しました', fileName };
}

module.exports = {
    runDailyBackup,
    runTenantBackup,
    listBackups,
    getBackupFileUrl
};
