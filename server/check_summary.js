require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function checkProgress() {
    try {
        console.log('--- Indexing Progress Summary ---');
        
        const { data: files, error: fileErr } = await supabaseAdmin
            .from('quotation_files')
            .select('id, original_name, mime_type');
        
        if (fileErr) throw fileErr;

        let totalTiles = 0;
        let fullyIndexed = 0;
        let partiallyIndexed = 0;
        let notIndexed = 0;

        for (const file of files) {
            const isImage = file.mime_type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic)$/i.test(file.original_name);
            const isPdf = file.mime_type === 'application/pdf' || file.original_name.toLowerCase().endsWith('.pdf');
            
            if (!(isPdf || isImage)) continue;

            const { count, error: countErr } = await supabaseAdmin
                .from('drawing_tiles')
                .select('*', { count: 'exact', head: true })
                .eq('file_id', file.id);
            
            if (countErr) continue;
            
            totalTiles += count;
            if (count >= 100) fullyIndexed++;
            else if (count > 0) partiallyIndexed++;
            else notIndexed++;
        }

        console.log(`Total Tiles in DB: ${totalTiles}`);
        console.log(`Fully Indexed (>=100 tiles): ${fullyIndexed}`);
        console.log(`Partially Indexed (>0, <100): ${partiallyIndexed}`);
        console.log(`Not Indexed (0 tiles): ${notIndexed}`);

    } catch (e) {
        console.error(e);
    }
}

checkProgress();
