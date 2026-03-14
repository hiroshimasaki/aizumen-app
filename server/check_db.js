require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function checkColumns() {
    try {
        const { data, error } = await supabaseAdmin
            .from('material_prices')
            .select('*')
            .limit(1);
        
        if (error) {
            console.error('Error fetching material_prices:', error);
        } else {
            console.log('Sample data keys:', data.length > 0 ? Object.keys(data[0]) : 'No data');
        }

        // 列情報を直接取得を試みる
        const { data: cols, error: colError } = await supabaseAdmin
            .rpc('get_table_columns', { table_name: 'material_prices' });
        
        if (colError) {
            console.log('RPC get_table_columns failed (expected if not defined)');
        } else {
            console.log('Columns:', cols);
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

checkColumns();
