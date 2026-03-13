require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function addColumn() {
    try {
        console.log('Adding scheduled_end_date column to quotation_items...');
        const { error } = await supabaseAdmin.rpc('exec_sql', {
            sql_query: 'ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS scheduled_end_date DATE;'
        });

        if (error) {
            console.error('Error adding column:', error);
            // Fallback: If exec_sql RPC is not available, we might need another way or tell the user.
            // But usually, we can run raw SQL via some admin tool.
        } else {
            console.log('Column added successfully.');
        }
    } catch (err) {
        console.error('Fatal error:', err);
    }
}

addColumn();
