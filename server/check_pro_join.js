const { supabaseAdmin } = require('./src/config/supabase');
async function run() {
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('id, name, slug, plan, trial_ends_at, subscriptions(*)')
    .eq('plan', 'pro');

  if (error) console.error(error);
  
  const results = data.map(t => ({
    name: t.name,
    plan: t.plan,
    has_sub: t.subscriptions && t.subscriptions.length > 0,
    sub_status: t.subscriptions && t.subscriptions[0] ? t.subscriptions[0].status : 'N/A',
    trial_ends_at: t.trial_ends_at
  }));
  
  console.table(results);
}
run();
