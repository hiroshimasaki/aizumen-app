require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function testInsert() {
    try {
        const testData = {
            tenant_id: '00000000-0000-0000-0000-000000000000', // 仮のテナントID（または実際のIDに置換）
            vendor_name: 'TEST VENDOR',
            material_type: 'SS400-D-TEST',
            shape: 'plate',
            min_dim: 0,
            max_dim: 9999,
            base_price_type: 'kg',
            unit_price: 100,
            density: 7.85,
            cutting_cost_factor: 1.0
        };

        const { data, error } = await supabaseAdmin
            .from('material_prices')
            .insert(testData)
            .select();

        if (error) {
            console.error('Insert failed:', error);
        } else {
            console.log('Insert success:', data);
            // 削除
            await supabaseAdmin.from('material_prices').delete().eq('id', data[0].id);
            console.log('Cleanup: Test record deleted');
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

testInsert();
