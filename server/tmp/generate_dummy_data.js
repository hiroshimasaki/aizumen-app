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
    '渡辺機械工業', '山本金型製作所', '中村エンジニアリング', '小林プラント工業',
    '加藤マシナリー', '吉田重工業', '山田バルブ製作所', '佐々木プレス',
    '山口ダイカスト', '松本テクロ', '井上システム', '木村プロテック'
];

const persons = ['佐藤', '田中', '鈴木', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田'];

const itemNames = [
    'アルミプレート A5052', 'SUS304 角パイプ', 'SS400 フランジ', '真鍮削り出しパーツ',
    '治具用ベースプレート', 'マシニング加工部品A', '旋盤加工シャフト', 'ブラケット L型',
    'カバー SUS HL仕上げ', '架台組立品', 'スペーサー t=2.0', '特殊ボルト M12',
    '搬送用ローラー', 'ギアボックスハウジング', 'モーター取付板'
];

const statuses = ['pending', 'ordered', 'lost'];

async function run() {
    console.log('Generating 100 dummy quotations with valid statuses...');

    for (let i = 0; i < 100; i++) {
        const company = companies[Math.floor(Math.random() * companies.length)];
        const person = persons[Math.floor(Math.random() * persons.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];

        // 日付生成
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 90)); // 最近90日以内
        const yy = String(date.getFullYear()).slice(-2);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const displayId = `Q${yy}${mm}${dd}-${String(i + 1).padStart(3, '0')}`;

        const { data: quotation, error: qError } = await supabase
            .from('quotations')
            .insert({
                tenant_id: TENANT_ID,
                display_id: displayId,
                company_name: company,
                contact_person: person,
                status: status,
                created_by: USER_ID,
                order_number: status === 'ordered' ? `PO-${10000 + i}` : '',
                construction_number: `C-${20000 + i}`,
                notes: '撮影用ダミーデータです。'
            })
            .select()
            .single();

        if (qError) {
            console.error(`Error inserting quotation ${i}:`, qError);
            continue;
        }

        const itemCount = Math.floor(Math.random() * 3) + 1;
        const itemRows = [];
        for (let j = 0; j < itemCount; j++) {
            const itemName = itemNames[Math.floor(Math.random() * itemNames.length)];
            const quantity = Math.floor(Math.random() * 50) + 1;
            const price = (Math.floor(Math.random() * 50) + 5) * 1000;

            const itemDate = new Date(date);
            itemDate.setDate(itemDate.getDate() + 14);

            itemRows.push({
                quotation_id: quotation.id,
                tenant_id: TENANT_ID,
                sort_order: j,
                name: itemName,
                quantity: quantity,
                processing_cost: price,
                material_cost: Math.floor(price * 0.4),
                other_cost: 0,
                due_date: itemDate.toISOString(),
                response_date: date.toISOString(),
                delivery_date: status === 'ordered' ? itemDate.toISOString() : null
            });
        }

        const { error: iError } = await supabase
            .from('quotation_items')
            .insert(itemRows);

        if (iError) {
            console.error(`Error inserting items for ${quotation.id}:`, iError);
        }

        if ((i + 1) % 10 === 0) {
            console.log(`Generated ${i + 1} quotations...`);
        }
    }

    console.log('Finished!');
}

run().catch(console.error);
