require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function checkFile() {
    try {
        const { data, error } = await supabaseAdmin
            .from('quotation_files')
            .select('*')
            .eq('id', 'a4fbd07e-9e8d-4878-b688-f722e513d7fe')
            .single();

        if (error) throw error;
        console.log('File details for a4fbd07e:');
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Check failed:', err.message);
    }
}

checkFile();
