require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');
const drawingSearchService = require('./src/services/ai/drawingSearchService');

async function reindexFile(fileId) {
    try {
        console.log(`--- Re-indexing File: ${fileId} ---`);
        const { data: fileMeta, error: metaErr } = await supabaseAdmin
            .from('quotation_files')
            .select('quotation_id, storage_path, mime_type, tenant_id')
            .eq('id', fileId)
            .single();
        
        if (metaErr) throw metaErr;

        const { data: fileBuffer, error: dlErr } = await supabaseAdmin.storage
            .from('quotation-files')
            .download(fileMeta.storage_path);
        
        if (dlErr) throw dlErr;

        const buffer = Buffer.from(await fileBuffer.arrayBuffer());
        console.log(`Downloaded buffer: ${buffer.length} bytes`);

        await drawingSearchService.registerDrawing(
            fileMeta.quotation_id,
            fileId,
            fileMeta.tenant_id,
            buffer,
            fileMeta.mime_type
        );
        console.log('Re-indexing attempt finished.');

    } catch (e) {
        console.error('Re-indexing failed:', e);
    }
}

// ユーザー指定のファイルをテスト
reindexFile('2a1f7060-00ee-4c1b-a88e-7a916a841f0b');
