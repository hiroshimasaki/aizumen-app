const { supabaseAdmin } = require('./src/config/supabase');

async function test() {
    console.log('Fetching subscriptions with plan=pro...');
    const { data: subs, error } = await supabaseAdmin
        .from('subscriptions')
        .select(`
            *,
            tenants!inner(
                id,
                plan,
                trial_ends_at
            )
        `)
        .eq('plan', 'pro');
    
    if (error) {
        console.error('Error:', error);
    } else {
        console.log(JSON.stringify(subs, null, 2));
    }
}

test();
