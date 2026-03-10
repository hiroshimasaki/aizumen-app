const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTenants() {
    const { data, error } = await supabase.from('tenants').select('id, name');
    if (error) {
        console.error('Error fetching tenants:', error);
        return;
    }
    console.log('Tenants:', JSON.stringify(data, null, 2));
}

checkTenants();
