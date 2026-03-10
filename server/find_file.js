require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function findTargetFile() {
    try {
        const target = '2a1f7060-00ee-4c1b-a88e-7a916a841f0b.pdf';
        const { data: files, error } = await supabaseAdmin
            .from('quotation_files')
            .select('id, original_name, mime_type, created_at')
            .or(`original_name.ilike.%${target}%,storage_path.ilike.%${target}%`);
        
        if (error) throw error;
        
        console.log('--- Search Result ---');
        if (files && files.length > 0) {
            for (const file of files) {
                const { count } = await supabaseAdmin
                    .from('drawing_tiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('file_id', file.id);
                console.log(`File: ${file.original_name} (ID: ${file.id})`);
                console.log(`  MIME: ${file.mime_type}`);
                console.log(`  Tiles: ${count}`);
            }
        } else {
            console.log('File not found.');
        }

    } catch (e) {
        console.error(e);
    }
}
findTargetFile();
