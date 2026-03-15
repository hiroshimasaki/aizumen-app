const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    const tenantId = 'c94934bf-d5b4-4e94-8987-60d07db7c022';
    const orderNumber = '3478565-00-00';
    console.log(`--- Searching for duplicates of Order Number: ${orderNumber} ---`);
    
    const { data: quotes, error: qErr } = await supabase
        .from('quotations')
        .select('id, order_number, construction_number, created_at, is_deleted, quotation_items(id, name, surface_treatment)')
        .eq('tenant_id', tenantId)
        .eq('order_number', orderNumber);
    
    if (qErr) {
        console.error(qErr);
    } else {
        console.log(`Found ${quotes.length} records:`);
        console.log(JSON.stringify(quotes, null, 2));
    }
}

check();
