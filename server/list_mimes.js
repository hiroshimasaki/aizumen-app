require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function listMimes() {
    const { data, error } = await supabaseAdmin
        .from('quotation_files')
        .select('original_name, mime_type, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
    
    if (error) console.error(error);
    else console.log(data);
}
listMimes();
