require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    // Get columns of quotations
    let { data: qCols, error: err1 } = await supabase.rpc('get_columns', { table_name: 'quotations' });
    if (err1) {
        // RPC might not exist, fallback to direct query if posibble but Supabase API doesn't allow information_schema from client easily.
        console.log("Cannot query DB schema using RPC.");
    }
}
main();
