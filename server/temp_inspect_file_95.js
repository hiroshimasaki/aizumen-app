require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function checkFile() {
    try {
        const { data, error } = await supabaseAdmin
            .from('quotation_files')
            .select('*')
            .eq('id', '96443dad-4bfc-41f6-9c17-48f1ddf14f68')
            .single();

        if (error) throw error;
        console.log('File details for 96443dad (95% match):');
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Check failed:', err.message);
    }
}

checkFile();
