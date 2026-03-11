require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function checkAll2689() {
    console.log(`--- Checking ALL files with '2689' ---`);
    const { data: files, error } = await supabaseAdmin
        .from('quotation_files')
        .select('id, original_name, tenant_id, created_at')
        .ilike('original_name', '%2689%');

    if (error) {
        console.error('Error fetching files:', error);
        return;
    }

    console.log(`Found ${files.length} files.`);
    for (const f of files) {
        const { count, error: countErr } = await supabaseAdmin
            .from('drawing_tiles')
            .select('*', { count: 'exact', head: true })
            .eq('file_id', f.id);
        
        console.log(`File: ${f.original_name}`);
        console.log(`  ID: ${f.id}`);
        console.log(`  Tenant: ${f.tenant_id}`);
        console.log(`  Date: ${f.created_at}`);
        console.log(`  Tiles: ${countErr ? 'Error' : count}`);
        console.log('---');
    }
}

checkAll2689();
