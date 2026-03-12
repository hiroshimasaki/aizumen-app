require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// --- 設定 ---
// ソース（検証環境）: .env から取得
const SOURCE_URL = process.env.SUPABASE_URL;
const SOURCE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ターゲット（本番環境）: 直接指定、または環境変数から
const TARGET_URL = process.env.PROD_SUPABASE_URL;
const TARGET_KEY = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY;

const BUCKET_NAME = 'quotation-files';

async function syncStorage(tenantId) {
    if (!TARGET_URL || !TARGET_KEY) {
        console.error('Error: 本番環境の URL または Service Role Key が設定されていません。');
        process.exit(1);
    }

    const sourceClient = createClient(SOURCE_URL, SOURCE_KEY);
    const targetClient = createClient(TARGET_URL, TARGET_KEY);

    console.log(`--- Storage Sync START [Tenant: ${tenantId || 'ALL'}] ---`);
    console.log(`Source: ${SOURCE_URL}`);
    console.log(`Target: ${TARGET_URL}`);

    // 現在の階層からファイルを再帰的に取得する関数
    async function processFolder(path) {
        console.log(`Listing files in: ${path || 'root'}`);
        
        let allItems = [];
        let offset = 0;
        const limit = 100;

        while (true) {
            const { data: items, error } = await sourceClient.storage.from(BUCKET_NAME).list(path, {
                limit: limit,
                offset: offset,
                sortBy: { column: 'name', order: 'asc' }
            });

            if (error) {
                console.error(`  List error [${path}]:`, error.message);
                return;
            }

            if (!items || items.length === 0) break;

            allItems = allItems.concat(items);
            if (items.length < limit) break;
            offset += limit;
        }

        for (const item of allItems) {
            const itemPath = path ? `${path}/${item.name}` : item.name;

            if (item.id === null) {
                // フォルダの場合、バックアップフォルダは除外
                if (item.name === 'backups') continue;
                // テナントID指定がある場合は、それ以外のUUIDフォルダはスキップ
                if (!path && tenantId && item.name !== tenantId) continue;
                
                await processFolder(itemPath);
            } else {
                // ファイルの場合、転送実行
                console.log(`  Syncing: ${itemPath} (${(item.metadata.size / 1024 / 1024).toFixed(2)} MB)`);
                
                // ダウンロード
                const { data: fileData, error: dlError } = await sourceClient.storage
                    .from(BUCKET_NAME)
                    .download(itemPath);
                
                if (dlError) {
                    console.error(`    Download FAILED: ${dlError.message}`);
                    continue;
                }

                // アップロード (オーバーライト設定)
                const { error: ulError } = await targetClient.storage
                    .from(BUCKET_NAME)
                    .upload(itemPath, fileData, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (ulError) {
                    console.error(`    Upload FAILED: ${ulError.message}`);
                } else {
                    console.log(`    SUCCESS.`);
                }
            }
        }
    }

    await processFolder('');
    console.log('\n--- Storage Sync FINISHED ---');
}

// 実行
// 引数にテナントIDを渡すとそのフォルダのみ同期します
const tid = process.argv[2];
syncStorage(tid);
