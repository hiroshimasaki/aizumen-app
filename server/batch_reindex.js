require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');
const drawingSearchService = require('./src/services/ai/drawingSearchService');

async function robustBatchReindex() {
    try {
        console.log('--- [Robust Batch Re-indexing Start] ---');
        
        // 全ファイルを取得
        const { data: files, error } = await supabaseAdmin
            .from('quotation_files')
            .select('id, quotation_id, storage_path, mime_type, tenant_id, original_name')
            .order('created_at', { ascending: false });
        
        if (error) throw error;

        console.log(`Target files total: ${files.length}`);

        let successCount = 0;
        let failCount = 0;
        let skipCount = 0;

        for (const file of files) {
            try {
                // 図面または画像かチェック
                const isImage = file.mime_type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic)$/i.test(file.original_name);
                const isPdf = file.mime_type === 'application/pdf' || file.original_name.toLowerCase().endsWith('.pdf');

                if (!(isPdf || isImage)) {
                    // console.log(`[SKIP] Not a drawing: ${file.original_name}`);
                    continue;
                }

                // タイルの存在確認
                const { count } = await supabaseAdmin
                    .from('drawing_tiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('file_id', file.id);

                // すでにタイルが存在する場合は、今回の「新設定」での処理済みとみなしてスキップ
                if (count > 0) {
                    console.log(`  [SKIP] Already indexed with new settings: ${file.original_name}`);
                    skipCount++;
                    continue;
                }

                console.log(`[PROCESS] Indexing: ${file.original_name}...`);

                const { data: fileBuffer, error: dlErr } = await supabaseAdmin.storage
                    .from('quotation-files')
                    .download(file.storage_path);
                
                if (dlErr) throw dlErr;

                const buffer = Buffer.from(await fileBuffer.arrayBuffer());
                await drawingSearchService.registerDrawing(
                    file.quotation_id,
                    file.id,
                    file.tenant_id,
                    buffer,
                    file.mime_type
                );
                
                console.log(`  [OK] Success: ${file.original_name}`);
                successCount++;

            } catch (err) {
                console.error(`  [ERROR] Failed: ${file.original_name}:`, err.message);
                failCount++;
                // 1ファイルのエラーで全体を止めない
            }
        }

        console.log('\n--- [Batch Re-indexing Finished] ---');
        console.log(`Total Success: ${successCount}`);
        console.log(`Total Skipped: ${skipCount}`);
        console.log(`Total Failed:  ${failCount}`);

    } catch (e) {
        console.error('Critical process error:', e);
    }
}

robustBatchReindex();
