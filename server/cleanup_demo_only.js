require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

const TARGET_TENANT_ID = 'c94934bf-d5b4-4e94-8987-60d07db7c022'; // 正木鉄工株式会社

async function cleanupDemo() {
    console.log('[Cleanup] Searching for DEMO- data...');
    
    // 1. DEMO- で始まる Quoations を取得
    const { data: demots, error: qError } = await supabaseAdmin
        .from('quotations')
        .select('id, display_id')
        .eq('tenant_id', TARGET_TENANT_ID)
        .like('display_id', 'DEMO-%');

    if (qError) throw qError;
    if (!demots || demots.length === 0) {
        console.log('[Cleanup] No demo data found.');
        return;
    }

    const ids = demots.map(q => q.id);
    console.log(`[Cleanup] Found ${ids.length} demo records:`, demots.map(q => q.display_id));

    // 2. 関連データの削除
    console.log('[Cleanup] Deleting tiles...');
    await supabaseAdmin.from('drawing_tiles').delete().in('quotation_id', ids);

    console.log('[Cleanup] Deleting quotation_files...');
    await supabaseAdmin.from('quotation_files').delete().in('quotation_id', ids);

    console.log('[Cleanup] Deleting quotation_items...');
    await supabaseAdmin.from('quotation_items').delete().in('quotation_id', ids);

    console.log('[Cleanup] Deleting quotations...');
    await supabaseAdmin.from('quotations').delete().in('id', ids);

    console.log('[Cleanup] Finished.');
}

cleanupDemo();
