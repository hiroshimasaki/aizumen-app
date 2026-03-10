const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const TENANT_ID = 'c94934bf-d5b4-4e94-8987-60d07db7c022';

async function diagnose() {
    console.log('--- Diagnosis Start ---');

    console.log('\nTest 1: Insert into quotations with string ID "Q-TEST-001"');
    const { error: qError } = await supabase.from('quotations').insert({
        id: 'Q-TEST-001',
        tenant_id: TENANT_ID,
        company_name: 'Diagnosis Test'
    });
    if (qError) {
        console.log('Result: Failed');
        console.log('Error Code:', qError.code);
        console.log('Error Message:', qError.message);
    } else {
        console.log('Result: Success! (So quotations.id IS a string)');
    }

    console.log('\nTest 2: Insert into quotation_items with string quotation_id "Q-TEST-001"');
    const { error: iError } = await supabase.from('quotation_items').insert({
        id: 'de151d66-6f99-44f9-b868-1b2f84d23fe7', // Valid UUID for item itself
        quotation_id: 'Q-TEST-001',
        tenant_id: TENANT_ID,
        name: 'Item Test'
    });
    if (iError) {
        console.log('Result: Failed');
        console.log('Error Code:', iError.code);
        console.log('Error Message:', iError.message);
    } else {
        console.log('Result: Success!');
    }

    console.log('\n--- Diagnosis End ---');
}

diagnose();
