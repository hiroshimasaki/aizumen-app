const { supabaseAdmin } = require('./src/config/supabase');

async function check() {
    console.log('--- AI CREDITS ---');
    const { data: credits, error: cErr } = await supabaseAdmin
        .from('ai_credits')
        .select('*');
    if (cErr) console.error(cErr);
    else console.table(credits);

    console.log('\n--- RECENT TRANSACTIONS ---');
    const { data: txs, error: tErr } = await supabaseAdmin
        .from('ai_credit_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
    if (tErr) console.error(tErr);
    else console.table(txs);
}

check();
