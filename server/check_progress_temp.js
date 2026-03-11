require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function checkCount() {
    try {
        const { count, error } = await supabaseAdmin
            .from('drawing_tiles')
            .select('*', { count: 'exact', head: true });
        
        if (error) throw error;
        console.log(`Current drawing_tiles total count: ${count}`);

        const { count: fileCount, error: fileErr } = await supabaseAdmin
            .from('quotation_files')
            .select('*', { count: 'exact', head: true });
        
        if (fileErr) throw fileErr;
        console.log(`Total quotation_files count: ${fileCount}`);

    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkCount();
