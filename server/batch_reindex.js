require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');
const searchService = require('./src/services/ai/drawingSearchService');

async function main() {
    console.log('--- Resumable Batch Re-indexing & Data Slimming START ---');
    
    // 1. 未処理のファイル一覧取得 (page_hash が NULL のもの)
    const { data: files, error: filesError } = await supabaseAdmin
        .from('quotation_files')
        .select('*')
        .is('page_hash', null) // レジューム機能: 未処理のみ
        .not('storage_path', 'is', null);
    
    if (filesError) {
        console.error('Fetch files error:', filesError);
        return;
    }
    
    console.log(`Remaining files to process: ${files.length}\n`);

    if (files.length === 0) {
        console.log('All files are already indexed. To force re-run, clear the page_hash column first.');
        return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const file of files) {
        console.log(`[${successCount + failCount + 1}/${files.length}] processing: ${file.original_name} (${file.id})`);
        
        try {
            // A. 既存の大容量タイルデータを完全削除 (DB容量削減)
            const { error: deleteError } = await supabaseAdmin
                .from('drawing_tiles')
                .delete()
                .eq('file_id', file.id);
            
            if (deleteError) {
                console.warn(`  - Warning during delete: ${deleteError.message}`);
            } else {
                console.log('  - Old tiles cleared.');
            }

            // B. Storageからダウンロード
            const { data: fileData, error: downloadError } = await supabaseAdmin.storage
                .from('quotation-files')
                .download(file.storage_path);
            
            if (downloadError) {
                throw new Error(`Download error: ${downloadError.message}`);
            }
            
            const buffer = Buffer.from(await fileData.arrayBuffer());
            
            // C. 再登録 (内部で pHash 生成 + 600x600 タイル作成 + ベクトル生成)
            // このメソッド内で成功時に quotation_files.page_hash が更新されるため、
            // 途中で止まっても次回実行時はこのファイルはスキップされます。
            await searchService.registerDrawing(
                file.quotation_id,
                file.id,
                file.tenant_id,
                buffer,
                file.mime_type
            );
            
            console.log('  - Re-indexing SUCCESS.');
            successCount++;
        } catch (err) {
            console.error(`  - FAILED: ${err.message}`);
            failCount++;
        }
        
        // 負荷分散のための短い休憩
        await new Promise(r => setTimeout(r, 500));
    }

    console.log(`\n--- Batch processing finished ---`);
    console.log(`Success: ${successCount}, Failed: ${failCount}`);
    console.log('Remaining tiles for other files are still in DB. To fully slim down, every file must be re-indexed.');
}

main();
