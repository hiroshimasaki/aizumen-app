require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRecentLogs() {
    console.log('--- Recent Access Logs ---');
    const { data: access, error: accessErr } = await supabase
        .from('system_access_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
    
    if (accessErr) console.error(accessErr);
    else access.forEach(l => console.log(`[${l.created_at}] ${l.method} ${l.path} -> ${l.status_code}`));

    console.log('\n--- Recent Error Logs ---');
    const { data: errors, error: errorErr } = await supabase
        .from('system_error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
        
    if (errorErr) console.error(errorErr);
    else errors.forEach(l => console.log(`[${l.created_at}] [${l.path}] ${l.message}`));
}

checkRecentLogs();
