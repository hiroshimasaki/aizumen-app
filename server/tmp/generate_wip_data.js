require('dotenv').config({ path: 'c:/Users/正木鉄工/OneDrive/デスクトップ/dev/AiZumen/server/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TENANT_ID = 'f2ce480d-4e1c-4e27-99c0-5a39037c85b1';
const USER_ID = '705146c0-9295-4aba-8ab7-8a787a9602eb';

const companies = [
    '株式会社 佐藤製作所', '田中工業 有限会社', '有限会社 鈴木鉄工', '伊藤精密株式会社',
    '渡辺機械工業', '山本金型製作所', '中村エンジニアリング', '小林プラント工業'
];

const itemNames = [
    '旋盤加工部品', 'フライス加工治具', 'マシニングプレート', 'レーザーカット部品',
    '溶接構造体', '研磨仕上げシャフト', 'ワイヤー放電加工コア'
];

async function run() {
    console.log('Generating 50 "In-Progress" quotations (Ordered but not delivered)...');

    for (let i = 0; i < 50; i++) {
        const company = companies[Math.floor(Math.random() * companies.length)];

        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 10)); // 直近10日以内
        const yy = String(date.getFullYear()).slice(-2);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const displayId = `Q${yy}${mm}${dd}-WIP${String(i + 1).padStart(3, '0')}`;

        const { data: quotation, error: qError } = await supabase
            .from('quotations')
            .insert({
                tenant_id: TENANT_ID,
                display_id: displayId,
                company_name: company,
                contact_person: '開発担当',
                status: 'ordered', // 受注済み
                created_by: USER_ID,
                order_number: `WIP-PO-${5000 + i}`,
                construction_number: `C-WIP-${6000 + i}`,
                notes: '【仕掛中表示テスト用】'
            })
            .select()
            .single();

        if (qError) {
            console.error(`Error:`, qError);
            continue;
        }

        const itemName = itemNames[Math.floor(Math.random() * itemNames.length)];
        const price = (Math.floor(Math.random() * 80) + 10) * 1000;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7 + Math.floor(Math.random() * 14)); // 納期は未来

        await supabase
            .from('quotation_items')
            .insert({
                quotation_id: quotation.id,
                tenant_id: TENANT_ID,
                sort_order: 0,
                name: itemName,
                quantity: Math.floor(Math.random() * 10) + 1,
                processing_cost: price,
                material_cost: Math.floor(price * 0.3),
                due_date: dueDate.toISOString().split('T')[0],
                response_date: date.toISOString().split('T')[0],
                delivery_date: null // 納品日は空（これによって「仕掛中」になる）
            });

        if ((i + 1) % 10 === 0) console.log(`Generated ${i + 1} WIP quotations...`);
    }

    console.log('Finished!');
}

run().catch(console.error);
