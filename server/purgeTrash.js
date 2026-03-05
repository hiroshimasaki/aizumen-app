/**
 * purgeTrash.js
 * ゴミ箱に30日以上滞在している案件を完全削除するスクリプト
 * 
 * 使用方法:
 *   node purgeTrash.js
 * 
 * cronで定期実行する場合の例 (毎日深夜3:00):
 *   0 3 * * * cd /path/to/server && node purgeTrash.js >> /var/log/purge-trash.log 2>&1
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const RETENTION_DAYS = 30;

async function purgeTrash() {
    console.log(`[PurgeTrash] Starting purge of items deleted more than ${RETENTION_DAYS} days ago...`);
    console.log(`[PurgeTrash] Timestamp: ${new Date().toISOString()}`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`[PurgeTrash] Cutoff date: ${cutoffISO}`);

    // 対象となる案件を取得
    const { data: targets, error: fetchError } = await supabase
        .from('quotations')
        .select('id, company_name, deleted_at, tenant_id')
        .eq('is_deleted', true)
        .lt('deleted_at', cutoffISO);

    if (fetchError) {
        console.error('[PurgeTrash] Error fetching targets:', fetchError.message);
        process.exit(1);
    }

    if (!targets || targets.length === 0) {
        console.log('[PurgeTrash] No items to purge. Done.');
        process.exit(0);
    }

    console.log(`[PurgeTrash] Found ${targets.length} items to purge:`);
    targets.forEach(t => {
        console.log(`  - [${t.id}] ${t.company_name || '(no name)'} (deleted: ${t.deleted_at})`);
    });

    let successCount = 0;
    let errorCount = 0;

    for (const target of targets) {
        try {
            // 1. 関連ファイルをストレージから削除
            const { data: files } = await supabase
                .from('quotation_files')
                .select('id, storage_path')
                .eq('quotation_id', target.id);

            if (files && files.length > 0) {
                const paths = files.map(f => f.storage_path).filter(Boolean);
                if (paths.length > 0) {
                    await supabase.storage.from('quotation-files').remove(paths);
                }
                // quotation_files レコード削除 (CASCADE設定がなければ手動)
                await supabase.from('quotation_files').delete().eq('quotation_id', target.id);
            }

            // 2. 関連明細を削除
            await supabase.from('quotation_items').delete().eq('quotation_id', target.id);

            // 3. 関連履歴を削除
            await supabase.from('quotation_history').delete().eq('quotation_id', target.id);

            // 4. 案件本体を完全削除
            const { error: deleteError } = await supabase
                .from('quotations')
                .delete()
                .eq('id', target.id);

            if (deleteError) {
                console.error(`[PurgeTrash] Failed to delete ${target.id}:`, deleteError.message);
                errorCount++;
            } else {
                console.log(`[PurgeTrash] Purged: ${target.id}`);
                successCount++;
            }
        } catch (err) {
            console.error(`[PurgeTrash] Error processing ${target.id}:`, err.message);
            errorCount++;
        }
    }

    console.log(`[PurgeTrash] Complete. Success: ${successCount}, Errors: ${errorCount}`);
    process.exit(errorCount > 0 ? 1 : 0);
}

purgeTrash();
