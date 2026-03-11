require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');
const { registerDrawing } = require('./src/services/ai/drawingSearchService');

async function reindexEmptyDrawings() {
    console.log('--- Re-indexing drawings with 0 tiles ---');
    
    // タイル数が0のファイルリスト（前回の調査結果から手動または動的に取得）
    const emptyFileIds = [
        '464f4bb2-9170-46cc-ab40-9a91a4282bcf',
        '181c0eae-5154-4817-9e5f-c4d2736e4838',
        '40cec5b4-72d3-4ba8-a960-4222f0436a72',
        '0963aa6f-fa70-4fd7-b38a-c4263446458a',
        'e421ec2c-0bf0-40e0-9ac3-8ad3a49c4e69',
        '17a93efd-13a7-4aef-8713-c9f8689f9c01'
    ];

    for (const fileId of emptyFileIds) {
        console.log(`\nProcessing file: ${fileId}`);
        try {
            // ファイル情報の取得
            const { data: file, error: fileError } = await supabaseAdmin
                .from('quotation_files')
                .select('*')
                .eq('id', fileId)
                .single();

            if (fileError || !file) {
                console.error(`Failed to fetch file ${fileId}:`, fileError);
                continue;
            }

            const storagePath = file.storage_path;
            console.log(`Original Name: ${file.original_name}, Storage Path: ${storagePath}`);

            if (!storagePath) {
                console.error(`Storage path not found for file ${fileId}`);
                continue;
            }

            // Storage からファイル実体をダウンロード
            const { data: buffer, error: downloadError } = await supabaseAdmin
                .storage
                .from('quotation-files')
                .download(storagePath);

            if (downloadError) {
                console.error(`Failed to download file ${fileId}:`, downloadError);
                continue;
            }

            // Blob を Buffer に変換
            const arrayBuffer = await buffer.arrayBuffer();
            const nodeBuffer = Buffer.from(arrayBuffer);

            // 再インデックス実行
            // registerDrawing(quotationId, fileId, tenantId, fileBuffer, mimeType)
            const drawingSearchService = require('./src/services/ai/drawingSearchService');
            const result = await drawingSearchService.registerDrawing(
                file.quotation_id, 
                fileId, 
                file.tenant_id, 
                nodeBuffer, 
                file.mime_type || 'application/pdf'
            );
            console.log(`Result: SUCCESS, Tiles generated.`);

        } catch (err) {
            console.error(`Error processing ${fileId}:`, err);
        }
    }

    console.log('\n--- Re-indexing process completed ---');
}

reindexEmptyDrawings();
