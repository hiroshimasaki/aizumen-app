require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function checkRecentLogs() {
    console.log('--- Latest 10 Tenants ---');
    const { data: tenants, error: tError } = await supabaseAdmin
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (tError) {
        console.error('Error fetching tenants:', tError);
    } else {
        tenants.forEach(t => {
            console.log(`[${t.created_at}] ID:${t.id} Name:${t.name}`);
        });
    }



    if (qError) {
        console.error('Error fetching quotations:', qError);
    } else {
        qts.forEach(q => {
            console.log(`[${q.created_at}] ID:${q.id} Co:${q.company_name} Order:${q.order_number}`);
        });
    }


    console.log('\n--- Recent Error Logs ---');
    const { data: errorLogs, error: errorError } = await supabaseAdmin
        .from('system_error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (errorError) {
        console.error('Error fetching error logs:', errorError);
    } else {
        errorLogs.forEach(log => {
            console.log(`[${log.created_at}] level:${log.level} message:${log.message.substring(0, 100)}`);
        });
    }
}

checkRecentLogs();
