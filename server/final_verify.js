require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');
const drawingSearchService = require('./src/services/ai/drawingSearchService');

async function finalVerification() {
    const fileId = '96443dad-4bfc-41f6-9c17-48f1ddf14f68'; // カツ-2689.pdf
    console.log(`--- Final Verification (Target Check) for: ${fileId} ---`);

    try {
        const { data: file } = await supabaseAdmin.from('quotation_files').select('*').eq('id', fileId).single();
        const { data: dl } = await supabaseAdmin.storage.from('quotation-files').download(file.storage_path);
        const buffer = Buffer.from(await dl.arrayBuffer());

        // 登録実行 (内部で imageService.preprocessImage と tileImage を呼ぶ)
        await drawingSearchService.registerDrawing(
            file.quotation_id,
            file.id,
            file.tenant_id,
            buffer,
            file.mime_type
        );

        // タイル数を確認
        const { count } = await supabaseAdmin
            .from('drawing_tiles')
            .select('*', { count: 'exact', head: true })
            .eq('file_id', file.id);
        
        console.log(`Verification SUCCESS: Generated ${count} tiles for ${file.original_name}`);

    } catch (err) {
        console.error(`Verification FAILED:`, err.message);
    }
}

finalVerification();
