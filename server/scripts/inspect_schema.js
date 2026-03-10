const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectSchema() {
    console.log('Inspecting quotations table schema...');

    // information_schema を直接叩く (RPC またはクエリ)
    // Supabase JS では直接クエリが難しいため、dummy insert のエラーから推測するか、
    // もし pg_meta があればそれを使うが、ここでは一件取得して中身を確認

    const { data, error } = await supabase.from('quotations').select('*').limit(1);

    if (error) {
        console.error('Error fetching quotations:', error);
    } else {
        console.log('Quotations sample record:', data);
    }

    // tenant_id の型を確認するために tenants テーブルも見る
    const { data: tenants, error: tError } = await supabase.from('tenants').select('*').limit(1);
    if (tError) console.error('Error fetching tenants:', tError);
    else console.log('Tenants sample:', tenants);
}

inspectSchema();
