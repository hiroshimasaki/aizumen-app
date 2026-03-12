require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findApiUrl() {
    console.log('Querying system_access_logs for production URL clues...');
    
    // Get latest access logs
    const { data: accessLogs, error: accessError } = await supabase
        .from('system_access_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (accessError) {
        console.error('Error fetching access logs:', accessError);
    } else {
        console.log('--- Latest Access Logs ---');
        accessLogs.forEach(log => {
            console.log(`[${log.created_at}] ${log.method} ${log.path} (Status: ${log.status_code})`);
        });
    }

    // Get latest error logs
    const { data: errorLogs, error: errorError } = await supabase
        .from('system_error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (errorError) {
        console.error('Error fetching error logs:', errorError);
    } else {
        console.log('\n--- Latest Error Logs ---');
        errorLogs.forEach(log => {
            console.log(`[${log.created_at}] ${log.message}`);
            if (log.stack) console.log(`Stack: ${log.stack.substring(0, 200)}...`);
        });
    }

    // Check for audit logs that might have the environment info
    const { data: auditLogs, error: auditError } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (!auditError) {
        console.log('\n--- Latest Audit Logs ---');
        auditLogs.forEach(log => {
            console.log(`[${log.created_at}] Action: ${log.action}, Description: ${log.description}`);
        });
    }
}

findApiUrl();
