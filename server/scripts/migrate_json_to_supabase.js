const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Supabaseクライアント設定 (Service Role Keyが必要)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 移行対象のテナントID（本番環境に合わせて書き換えてください）
const TARGET_TENANT_ID = 'YOUR-TENANT-UUID';
const CREATED_BY_USER_ID = 'YOUR-ADMIN-USER-UUID';

async function migrate() {
    console.log('--- Migration Started ---');

    try {
        // 1. JSONファイルの存在確認
        const quotationsPath = path.join(__dirname, '../data/quotations.json');
        const companiesPath = path.join(__dirname, '../data/companies.json');

        if (!fs.existsSync(quotationsPath)) {
            console.error('Error: quotations.json not found in server/data/');
            return;
        }

        const quotations = JSON.parse(fs.readFileSync(quotationsPath, 'utf8'));
        const companyNames = fs.existsSync(companiesPath) ? JSON.parse(fs.readFileSync(companiesPath, 'utf8')) : [];

        console.log(`Processing ${quotations.length} quotations and ${companyNames.length} companies...`);

        // 2. 会社マスタの移行
        console.log('Step 1: Migrating companies...');
        const uniqueCompanies = [...new Set([
            ...companyNames,
            ...quotations.map(q => q.companyName).filter(Boolean)
        ])];

        const companyMap = new Map(); // name -> id

        for (const name of uniqueCompanies) {
            const { data, error } = await supabase
                .from('companies')
                .upsert({
                    tenant_id: TARGET_TENANT_ID,
                    name: name,
                }, { onConflict: 'tenant_id, name' })
                .select('id')
                .single();

            if (error) {
                console.warn(`Failed to upsert company: ${name}`, error.message);
            } else {
                companyMap.set(name, data.id);
            }
        }

        // 3. 見積データの移行
        console.log('Step 2: Migrating quotations...');
        for (const q of quotations) {
            process.stdout.write(`Processing: ${q.id} ... `);

            // 日付のクレンジング
            const cleanDate = (d) => (d && d.trim() !== "" ? d : null);

            // 見積メインデータの登録
            const { error: qError } = await supabase
                .from('quotations')
                .upsert({
                    id: q.id,
                    tenant_id: TARGET_TENANT_ID,
                    company_id: companyMap.get(q.companyName) || null,
                    company_name: q.companyName || '',
                    contact_person: q.contactPerson || '',
                    email_link: q.emailLink || '',
                    notes: q.notes || '',
                    order_number: q.orderNumber || '',
                    construction_number: q.constructionNumber || '',
                    status: ['pending', 'ordered', 'lost'].includes(q.status) ? q.status : 'pending',
                    source_id: q.sourceId || null,
                    created_by: CREATED_BY_USER_ID,
                    created_at: q.createdAt || new Date().toISOString(),
                    updated_at: q.updatedAt || new Date().toISOString(),
                });

            if (qError) {
                console.error(`\nFailed to migrate quotation ${q.id}:`, qError);
                continue;
            }

            // 4. 明細行 (Items)
            if (q.items && q.items.length > 0) {
                const itemsToInsert = q.items.map((item, idx) => ({
                    quotation_id: q.id,
                    tenant_id: TARGET_TENANT_ID,
                    sort_order: idx,
                    name: item.name || '',
                    quantity: parseFloat(item.quantity) || 0,
                    processing_cost: parseFloat(item.processingCost) || 0,
                    material_cost: parseFloat(item.materialCost) || 0,
                    other_cost: parseFloat(item.otherCost) || 0,
                    response_date: cleanDate(item.responseDate),
                    due_date: cleanDate(item.dueDate),
                    delivery_date: cleanDate(item.deliveryDate),
                    scheduled_start_date: cleanDate(item.scheduledStartDate),
                    actual_hours: parseFloat(item.actualHours) || 0,
                    actual_processing_cost: parseFloat(item.actualProcessingCost) || 0,
                    actual_material_cost: parseFloat(item.actualMaterialCost) || 0,
                    actual_other_cost: parseFloat(item.actualOtherCost) || 0,
                    actual_mode: item._actualMode || 'amount'
                }));

                const { error: itemsError } = await supabase.from('quotation_items').insert(itemsToInsert);
                if (itemsError) console.warn(`\n  Failed to insert items for ${q.id}:`, itemsError.message);
            }

            // 5. ファイル情報 (Files)
            if (q.files && q.files.length > 0) {
                const filesToInsert = q.files.map(f => ({
                    quotation_id: q.id,
                    tenant_id: TARGET_TENANT_ID,
                    storage_path: f.path.replace(/^\/uploads\//, ''), // Storage内パスに変換
                    original_name: f.originalName || 'unknown',
                    file_hash: f.hash || null,
                    file_type: 'attachment'
                }));

                const { error: filesError } = await supabase.from('quotation_files').insert(filesToInsert);
                if (filesError) console.warn(`\n  Failed to insert files for ${q.id}:`, filesError.message);
            }

            console.log('Done');
        }

        console.log('\n--- Migration Completed Successfully ---');

    } catch (err) {
        console.error('\nFatal Error during migration:', err);
    }
}

migrate();
