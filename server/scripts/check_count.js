const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const TARGET_TENANT_ID = 'c94934bf-d5b4-4e94-8987-60d07db7c022';

async function checkCount() {
    const { count, error } = await supabase
        .from('quotations')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', TARGET_TENANT_ID);

    if (error) {
        console.error('Error fetching count:', error);
    } else {
        console.log(`Current Quotations count: ${count} / 123`);
    }

    const { count: fileCount, error: fError } = await supabase
        .from('quotation_files')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', TARGET_TENANT_ID);

    if (!fError) {
        console.log(`Current Files count: ${fileCount}`);
    }
}

checkCount();
