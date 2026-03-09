const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ターゲットテナントID: 正木鉄工株式会社
const TARGET_TENANT_ID = 'c94934bf-d5b4-4e94-8987-60d07db7c022';
const JSON_PATH = path.join(__dirname, '../../../開発/quotation-tool/server/data/quotations.json');

// ステータスマッピング
const STATUS_MAP = {
    'lost': 'lost',
    'ordered': 'ordered',
    'pending': 'pending',
    'delivered': 'delivered'
};

async function migrate() {
    console.log('--- Migration Started ---');
    const isDryRun = process.argv.includes('--dry-run');
    if (isDryRun) console.log('*** DRY RUN MODE - No changes will be saved ***');

    if (!fs.existsSync(JSON_PATH)) {
        console.error('Source JSON not found at:', JSON_PATH);
        return;
    }

    const rawData = fs.readFileSync(JSON_PATH, 'utf8');
    const quotations = JSON.parse(rawData);
    console.log(`Found ${quotations.length} quotations in source JSON.`);

    // 1. Get existing companies for the tenant
    const { data: companies } = await supabase.from('companies').select('id, name').eq('tenant_id', TARGET_TENANT_ID);
    const companyMap = new Map((companies || []).map(c => [c.name, c.id]));

    for (const q of quotations) {
        try {
            console.log(`Processing: ${q.companyName} (${q.id})`);

            // Step 1: Ensure Company exists
            let companyId = companyMap.get(q.companyName);
            if (!companyId) {
                if (isDryRun) {
                    console.log(`  [DRY] Would create company: ${q.companyName}`);
                    companyId = 'new-company-placeholder';
                } else {
                    const { data: newCompany, error: compErr } = await supabase
                        .from('companies')
                        .insert({ name: q.companyName, tenant_id: TARGET_TENANT_ID })
                        .select()
                        .single();
                    if (compErr) throw compErr;
                    companyId = newCompany.id;
                    companyMap.set(q.companyName, companyId);
                    console.log(`  Created company: ${q.companyName}`);
                }
            }

            // Step 2: Insert Quotation
            const quotationData = {
                tenant_id: TARGET_TENANT_ID,
                company_id: companyId,
                company_name: q.companyName,
                contact_person: q.contactPerson,
                email_link: q.emailLink,
                notes: q.notes,
                status: STATUS_MAP[q.status] || 'pending',
                created_at: q.createdAt,
                updated_at: q.updatedAt
            };

            let newQuotationId;
            if (isDryRun) {
                console.log(`  [DRY] Would insert quotation for ${q.companyName}`);
                newQuotationId = 'new-quotation-placeholder';
            } else {
                const { data: newQ, error: qErr } = await supabase
                    .from('quotations')
                    .insert(quotationData)
                    .select()
                    .single();
                if (qErr) throw qErr;
                newQuotationId = newQ.id;
            }

            // Step 3: Insert Items
            if (q.items && q.items.length > 0) {
                const itemsData = q.items.map(item => ({
                    quotation_id: newQuotationId,
                    tenant_id: TARGET_TENANT_ID,
                    name: item.name,
                    processing_cost: item.processingCost || 0,
                    material_cost: item.materialCost || 0,
                    other_cost: item.otherCost || 0,
                    quantity: item.quantity || 1,
                    unit: 'pcs',
                    due_date: item.dueDate || null,
                    response_date: item.responseDate || null,
                    actual_hours: item.actualHours || 0,
                    actual_processing_cost: item.actualProcessingCost || 0,
                    actual_material_cost: item.actualMaterialCost || 0,
                    actual_other_cost: item.actualOtherCost || 0,
                    delivery_date: item.deliveryDate || null
                }));

                if (isDryRun) {
                    console.log(`  [DRY] Would insert ${itemsData.length} items`);
                } else {
                    const { error: itemsErr } = await supabase
                        .from('quotation_items')
                        .insert(itemsData);
                    if (itemsErr) throw itemsErr;
                }
            }

            // Step 4: Insert Files (metadata only as physical files are separate)
            if (q.files && q.files.length > 0) {
                const filesData = q.files.map(f => ({
                    quotation_id: newQuotationId,
                    tenant_id: TARGET_TENANT_ID,
                    original_name: f.originalName,
                    storage_path: f.path, // path is used as storage_path
                    file_type: 'application/pdf', // based on .pdf extension in paths
                    size: 0 // unknown from JSON
                }));

                if (isDryRun) {
                    console.log(`  [DRY] Would insert ${filesData.length} file records`);
                } else {
                    const { error: filesErr } = await supabase
                        .from('quotation_files')
                        .insert(filesData);
                    if (filesErr) throw filesErr;
                }
            }

        } catch (err) {
            console.error(`Error processing ${q.id}:`, err.message);
        }
    }

    console.log('--- Migration Finished ---');
}

migrate();
