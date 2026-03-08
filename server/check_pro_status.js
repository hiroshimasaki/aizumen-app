const { supabaseAdmin } = require('./src/config/supabase');
async function run() {
  console.log('--- Pro Plan Tenants ---');
  const { data: tenants, error: tErr } = await supabaseAdmin.from('tenants').select('id, name, slug, plan, trial_ends_at').eq('plan', 'pro');
  if (tErr) console.error(tErr);
  console.table(tenants);

  console.log('--- Subscriptions for Pro Tenants ---');
  const tenantIds = tenants.map(t => t.id);
  const { data: subs, error: sErr } = await supabaseAdmin.from('subscriptions').select('*').in('tenant_id', tenantIds);
  if (sErr) console.error(sErr);
  console.table(subs.map(s => ({
    tenant_id: s.tenant_id,
    plan: s.plan,
    status: s.status,
    max_users: s.max_users,
    current_period_end: s.current_period_end
  })));
}
run();
