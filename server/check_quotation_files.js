const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/.env' });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    try {
        const { data, error } = await supabase
            .from('quotation_files')
            .select('*')
            .limit(1);

        if (error) {
            console.error('Check failed:', error.message, error.code);
        } else {
            console.log('--- quotation_files sample data ---');
            console.log(JSON.stringify(data[0], null, 2));
        }
    } catch (err) {
        console.error('Execution error:', err);
    }
}

check();
