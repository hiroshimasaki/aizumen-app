require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');
const drawingSearchService = require('./src/services/ai/drawingSearchService');

async function reindexIncompleteDrawings() {
    console.log('--- Re-indexing incomplete drawings (low tile count) ---');
    
    try {
        // 1. 全ファイルを取得して調査
        const { data: files, error: fileQueryError } = await supabaseAdmin
            .from('quotation_files')
            .select('id, original_name');

        if (fileQueryError) throw fileQueryError;

        const incompleteFileIds = [];
        for (const fileItem of files) {
            const { count, error: countError } = await supabaseAdmin
                .from('drawing_tiles')
                .select('*', { count: 'exact', head: true })
                .eq('file_id', fileItem.id);

            if (countError) {
                console.error(`Error counting tiles for ${fileItem.id}:`, countError);
                continue;
            }

            // タイル数が50枚未満を不完全とみなす
            // カツ-2689.pdf (ID: 96443dad...) は 23枚 なので必ずヒットするはず
            if (count < 50) {
                incompleteFileIds.push({ id: fileItem.id, count, name: fileItem.original_name });
            }
        }

        if (incompleteFileIds.length === 0) {
            console.log('No incomplete drawings found.');
            return;
        }

        console.log(`Found ${incompleteFileIds.length} incomplete drawings:`);
        for (const f of incompleteFileIds) {
            console.log(`- ${f.name || 'Unknown'} (ID: ${f.id}, Current Tiles: ${f.count})`);
        }

        for (const f of incompleteFileIds) {
            const fileId = f.id;
            console.log(`\n>>> Processing: ${fileId}`);

            // 2. 既存タイルの削除
            console.log(`Deleting existing ${f.count} tiles...`);
            const { error: deleteError } = await supabaseAdmin
                .from('drawing_tiles')
                .delete()
                .eq('file_id', fileId);

            if (deleteError) {
                console.error(`Failed to delete tiles for ${fileId}:`, deleteError);
                continue;
            }

            // 3. ファイル情報の取得
            const { data: file, error: fileError } = await supabaseAdmin
                .from('quotation_files')
                .select('*')
                .eq('id', fileId)
                .single();

            if (fileError || !file) {
                console.error(`Failed to fetch file info for ${fileId}:`, fileError);
                continue;
            }

            // 4. ダウンロードと再インデックス
            console.log(`Downloading file: ${file.original_name}`);
            const { data: buffer, error: downloadError } = await supabaseAdmin
                .storage
                .from('quotation-files')
                .download(file.storage_path);

            if (downloadError) {
                console.error(`Failed to download file ${fileId}:`, downloadError);
                continue;
            }

            const arrayBuffer = await buffer.arrayBuffer();
            const nodeBuffer = Buffer.from(arrayBuffer);

            console.log(`Starting registerDrawing...`);
            await drawingSearchService.registerDrawing(
                file.quotation_id,
                fileId,
                file.tenant_id,
                nodeBuffer,
                file.mime_type || 'application/pdf'
            );
            console.log(`Successfully re-indexed: ${file.original_name}`);
        }

    } catch (err) {
        console.error('Final Error:', err);
    }

    console.log('\n--- Re-indexing completed ---');
}

reindexIncompleteDrawings();
