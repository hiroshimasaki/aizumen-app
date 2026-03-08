const { supabaseAdmin } = require('./src/config/supabase');

async function test() {
    console.log('Fetching subscriptions for tenant 2cb3e044-c355-4f6d-8cc9-0da3933b6f70 ...');
    const { data: subs, error } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', '2cb3e044-c355-4f6d-8cc9-0da3933b6f70');
    
    if (error) {
        console.error('Error:', error);
    } else {
        console.log(JSON.stringify(subs, null, 2));
    }
}

test();
