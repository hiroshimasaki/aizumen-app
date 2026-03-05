const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrate() {
    console.log('Starting migration for logical delete...');

    // 注意: @supabase/supabase-js は直接的な ALTER TABLE SQL を実行するメソッドを持たないため
    // 通常はダミーのインサートや RPC を通じて行うか、あるいは単に新しいカラムにデータを書き込むことで暗黙的に動作を確認します。
    // しかし、完全に新しいカラムを追加するには SQL Editor か マイグレーションツールが必要です。

    // ここでは、RPC (Stored Function) が定義されていると仮定してそれを呼び出すか、
    // あるいは単純に既存のテーブルにデータを入れてみて、エラーが出るか（カラムが存在するか）を確認します。

    try {
        const { error } = await supabase
            .from('quotations')
            .select('is_deleted')
            .limit(1);

        if (error && error.code === '42703') {
            console.log('Column is_deleted does not exist. Please add it via Supabase SQL Editor:');
            console.log('ALTER TABLE quotations ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;');
            console.log('CREATE INDEX idx_quotations_is_deleted ON quotations(tenant_id, is_deleted);');
        } else {
            console.log('Column is_deleted already exists or check failed:', error ? error.message : 'Success');
        }
    } catch (err) {
        console.error('Migration check failed:', err);
    }
}

migrate();
