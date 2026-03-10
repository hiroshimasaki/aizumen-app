require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function checkRecentFiles() {
    try {
        console.log('--- Recent Uploaded Files ---');
        const { data: files, error: fileErr } = await supabaseAdmin
            .from('quotation_files')
            .select('id, original_name, created_at, tenant_id')
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (fileErr) throw fileErr;

        for (const file of files) {
            const { count, error: countErr } = await supabaseAdmin
                .from('drawing_tiles')
                .select('*', { count: 'exact', head: true })
                .eq('file_id', file.id);
            
            console.log(`File: ${file.original_name} (ID: ${file.id})`);
            console.log(`  Uploaded at: ${file.created_at}`);
            console.log(`  Tiles indexed: ${countErr ? 'Error' : count}`);
        }

    } catch (e) {
        console.error('Check failed:', e);
    }
}

checkRecentFiles();
