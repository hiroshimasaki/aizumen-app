const { supabaseAdmin } = require('./src/config/supabase');

async function test() {
    console.log('Fetching all tenants with plan=pro ...');
    const { data: tenants, error } = await supabaseAdmin
        .from('tenants')
        .select('*')
        .eq('plan', 'pro');
    
    if (error) {
        console.error('Error:', error);
    } else {
        console.log(JSON.stringify(tenants, null, 2));
    }
}

test();
