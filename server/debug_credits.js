const { supabaseAdmin } = require('./src/config/supabase');
require('dotenv').config();

async function checkTransactions() {
    const tenantId = '9106629a-62ec-49f2-919a-d7ded4bba1cd';
    console.log(`Checking transactions for tenant: ${tenantId}`);

    const { data, error } = await supabaseAdmin
        .from('ai_credit_transactions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Transactions:');
    console.table(data.map(t => ({
        date: t.created_at,
        amount: t.amount,
        type: t.type,
        desc: t.description
    })));

    const { data: credits } = await supabaseAdmin
        .from('ai_credits')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

    console.log('\nCurrent Balance:', credits);
}

checkTransactions();
