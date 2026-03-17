require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function inspect() {
    console.log('[Inspect] Checking DB connectivity and data...');
    
    const { data: tenants, error: tError } = await supabaseAdmin.from('tenants').select('*').limit(5);
    if (tError) {
        console.error('Tenants Error:', tError);
    } else {
        console.log('Tenants:', tenants.map(t => ({ id: t.id, name: t.name })));
    }

    const { data: users, error: uError } = await supabaseAdmin.from('users').select('*').limit(5);
    if (uError) {
        console.error('Users Error:', uError);
    } else {
        console.log('Users:', users.map(u => ({ id: u.id, email: u.email, tenant_id: u.tenant_id })));
    }
}

inspect();
