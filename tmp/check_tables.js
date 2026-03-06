const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    console.log('Checking audit_logs table...');
    const { data, error } = await supabase.from('audit_logs').select('*').limit(1);
    if (error) {
        console.error('Error fetching audit_logs:', error.message);
    } else {
        console.log('audit_logs table exists. Found rows:', data.length);
    }

    console.log('Checking system_error_logs table...');
    const { error: eError } = await supabase.from('system_error_logs').select('*').limit(1);
    if (eError) {
        console.error('Error fetching system_error_logs:', eError.message);
    } else {
        console.log('system_error_logs table exists.');
    }
}

check();
