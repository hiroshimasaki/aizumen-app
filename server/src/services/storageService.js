const { supabaseAdmin } = require('../config/supabase');

/**
 * テナントのストレージ使用量を再計算し、DBを更新するサービス
 */
class StorageService {
    /**
     * 特定テナントのストレージ総使用量を計算して保存
     * (本体ファイル + サムネイル + バックアップ)
     */
    async updateTenantUsage(tenantId) {
        try {
            console.log(`[StorageService] Updating usage for tenant: ${tenantId}`);

            // 1. 本体ファイルの合計を取得
            const { data: fileUsage } = await supabaseAdmin
                .from('quotation_files')
                .select('file_size')
                .eq('tenant_id', tenantId);
            
            let totalBytes = fileUsage?.reduce((sum, f) => sum + (f.file_size || 0), 0) || 0;

            // 2. サムネイルの合計を取得 (Storage API を使用)
            // サムネイルは DB にサイズがないため、Storage から直接リスト取得して合計
            const { data: thumbnails } = await supabaseAdmin.storage
                .from('quotation-files')
                .list('thumbnails', {
                    limit: 1000, // 便宜上多めに取得
                });
            
            // ファイル名が fileId であるもの（そのテナントのファイルに属するもの）を特定して加算
            // 本来は thumbnails/ フォルダ内をテナント分離すべきだが、現在はフラットなため、
            // そのテナントの quotation_files.id と一致するもののみ合計する
            if (thumbnails && thumbnails.length > 0) {
                const { data: tenantFileIds } = await supabaseAdmin
                    .from('quotation_files')
                    .select('id')
                    .eq('tenant_id', tenantId);
                
                const idSet = new Set(tenantFileIds?.map(f => f.id));
                const tenantThumbs = thumbnails.filter(t => idSet.has(t.name.replace('.png', '')));
                const thumbSize = tenantThumbs.reduce((sum, t) => sum + (t.metadata?.size || 0), 0);
                totalBytes += thumbSize;
                console.log(`[StorageService] Thumbnail size for ${tenantId}: ${thumbSize} bytes`);
            }

            // 3. バックアップの合計を取得
            const { data: backups } = await supabaseAdmin.storage
                .from('quotation-files')
                .list(`backups/${tenantId}`);
            
            if (backups && backups.length > 0) {
                const backupSize = backups.reduce((sum, b) => sum + (b.metadata?.size || 0), 0);
                totalBytes += backupSize;
                console.log(`[StorageService] Backup size for ${tenantId}: ${backupSize} bytes`);
            }

            // 4. DB (tenants テーブル) を更新
            const { error: updateError } = await supabaseAdmin
                .from('tenants')
                .update({ 
                    storage_usage_bytes: totalBytes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', tenantId);

            if (updateError) throw updateError;

            console.log(`[StorageService] Final usage for ${tenantId}: ${totalBytes} bytes`);
            return totalBytes;
        } catch (err) {
            console.error(`[StorageService] Failed to update usage for ${tenantId}:`, err);
            throw err;
        }
    }

    /**
     * 全テナントの使用量を一括更新 (メンテナンス用)
     */
    async updateAllTenantsUsage() {
        const { data: tenants } = await supabaseAdmin.from('tenants').select('id');
        if (!tenants) return;

        for (const t of tenants) {
            await this.updateTenantUsage(t.id);
        }
    }
}

module.exports = new StorageService();
