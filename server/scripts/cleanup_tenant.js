const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_TENANT_ID = 'c94934bf-d5b4-4e94-8987-60d07db7c022'; // 正木鉄工株式会社

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Environment variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function cleanup() {
    console.log(`Starting cleanup for tenant: ${TARGET_TENANT_ID}`);

    try {
        // 1. DBデータの削除 (外部キー制約のため逆順)
        console.log('Deleting DB records...');

        // drawing_tiles
        const { error: dtError } = await supabase.from('drawing_tiles').delete().eq('tenant_id', TARGET_TENANT_ID);
        if (dtError) throw dtError;
        console.log('- drawing_tiles deleted');

        // quotation_files
        const { error: qfError } = await supabase.from('quotation_files').delete().eq('tenant_id', TARGET_TENANT_ID);
        if (qfError) throw qfError;
        console.log('- quotation_files deleted');

        // quotation_items
        const { error: qiError } = await supabase.from('quotation_items').delete().eq('tenant_id', TARGET_TENANT_ID);
        if (qiError) throw qiError;
        console.log('- quotation_items deleted');

        // quotations
        const { error: qError } = await supabase.from('quotations').delete().eq('tenant_id', TARGET_TENANT_ID);
        if (qError) throw qError;
        console.log('- quotations deleted');

        // 2. Storage ファイルの削除
        console.log('Cleaning up Storage...');
        const bucketName = 'quotation-files';

        // 該当テナントのフォルダ内のファイル一覧を取得
        const { data: files, error: listError } = await supabase.storage
            .from(bucketName)
            .list(TARGET_TENANT_ID, { limit: 1000 });

        if (listError) {
            console.error('Error listing storage files:', listError);
        } else if (files && files.length > 0) {
            const filesToRemove = files.map(f => `${TARGET_TENANT_ID}/${f.name}`);

            // フォルダの中身も再帰的に消す必要がある場合があるが、まずは直下を消去
            // （現状の構造では quotationId ごとにフォルダがあるため、さらに深くリストする必要がある）

            // 再帰的な全削除を試みるため、各サブフォルダ(quotationId)も処理
            for (const item of files) {
                if (!item.id) { // idがない場合はフォルダ
                    const { data: subFiles } = await supabase.storage.from(bucketName).list(`${TARGET_TENANT_ID}/${item.name}`);
                    if (subFiles && subFiles.length > 0) {
                        const subPaths = subFiles.map(sf => `${TARGET_TENANT_ID}/${item.name}/${sf.name}`);
                        const { error: removeError } = await supabase.storage.from(bucketName).remove(subPaths);
                        if (removeError) console.error(`Failed to remove subfiles in ${item.name}:`, removeError);
                        else console.log(`- Removed files in folder: ${item.name}`);
                    }
                } else {
                    const { error: removeError } = await supabase.storage.from(bucketName).remove([`${TARGET_TENANT_ID}/${item.name}`]);
                    if (removeError) console.error(`Failed to remove file ${item.name}:`, removeError);
                }
            }

            // 最後に空になったサブフォルダ自体を消す（Supabase Storageではファイルがなくなれば消えることが多い）
            console.log('- Storage cleanup completed (up to 1 level depth)');
        } else {
            console.log('- No files found in storage for this tenant.');
        }

        console.log('Cleanup finished successfully.');

    } catch (err) {
        console.error('Cleanup failed:', err.message);
        process.exit(1);
    }
}

cleanup();
