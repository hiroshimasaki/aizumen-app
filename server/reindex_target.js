require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');
const searchService = require('./src/services/ai/drawingSearchService');

async function main() {
    console.log('--- Force Re-indexing Target File ---');
    
    // 1. ファイル情報の取得
    const { data: file, error: fileError } = await supabaseAdmin
        .from('quotation_files')
        .select('*')
        .like('original_name', '%カツ-2689%')
        .single();
    
    if (fileError || !file) {
        console.error('File found error:', fileError);
        return;
    }
    
    console.log(`Targeting: ${file.original_name} (${file.id})`);

    // 2. 既存タイルの削除
    const { error: deleteError } = await supabaseAdmin
        .from('drawing_tiles')
        .delete()
        .eq('file_id', file.id);
    
    if (deleteError) {
        console.error('Delete error:', deleteError);
        return;
    }
    console.log('Deleted old tiles.');

    // 3. Storageからダウンロードして再インデックス
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from('quotation-files')
        .download(file.storage_path);
    
    if (downloadError) {
        console.error('Download error:', downloadError);
        return;
    }
    
    const buffer = Buffer.from(await fileData.arrayBuffer());
    console.log('Downloaded file. Starting re-indexing...');

    await searchService.registerDrawing(
        file.quotation_id,
        file.id,
        file.tenant_id,
        buffer,
        file.mime_type
    );

    console.log('Re-indexing COMPLETED successfully.');
}

main();
