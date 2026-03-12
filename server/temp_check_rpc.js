require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function checkRpc() {
    try {
        const { data, error } = await supabaseAdmin.rpc('get_function_definition', { function_name: 'match_drawing_by_hash' });
        if (error) {
            // もし get_function_definition がなければ直接クエリ
            console.log('RPC check failed, trying information_schema...');
            const { data: info, error: infoError } = await supabaseAdmin
                .from('pg_proc')
                .select('prosrc')
                .eq('proname', 'match_drawing_by_hash');
            if (infoError) throw infoError;
            console.log('Function Source:');
            console.log(info[0].prosrc);
        } else {
            console.log(data);
        }
    } catch (err) {
        console.error('Check failed:', err.message);
    }
}

checkRpc();
