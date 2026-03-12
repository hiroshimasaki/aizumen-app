require('dotenv').config({ path: './.env' });
const { supabaseAdmin } = require('./src/config/supabase');


async function checkLogs() {
    console.log('Fetching access logs with status >= 400 from the last 30 minutes...');
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: logs, error } = await supabaseAdmin
        .from('system_access_logs')
        .select('*')
        .gt('created_at', thirtyMinutesAgo)
        .gte('status_code', 400)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }

    if (logs.length === 0) {
        console.log('No error access logs found in the last 30 minutes.');
    }

    logs.forEach(log => {
        console.log('---');
        console.log(`Time: ${log.created_at}`);
        console.log(`Method: ${log.method}`);
        console.log(`Path: ${log.path}`);
        console.log(`Status: ${log.status_code}`);
        console.log(`Duration: ${log.duration_ms}ms`);
    });
}

checkLogs();
