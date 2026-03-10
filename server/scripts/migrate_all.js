const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

// 再利用可能なサービス（図面インデックス登録用）
const drawingSearchService = require('../src/services/ai/drawingSearchService');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_TENANT_ID = 'c94934bf-d5b4-4e94-8987-60d07db7c022'; // 正木鉄工株式会社

// 旧データの所在
const OLD_DATA_DIR = 'C:\\Users\\正木鉄工\\OneDrive\\デスクトップ\\開発\\quotation-tool\\server\\data';
const OLD_UPLOADS_DIR = 'C:\\Users\\正木鉄工\\OneDrive\\デスクトップ\\開発\\quotation-tool\\server\\uploads';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function calculateHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

// QYYMMDD-XXX 形式のID生成用
let lastDateStr = '';
let sequence = 0;

function generateNewQuotationId(createdAt) {
    const date = new Date(createdAt);
    const dateStr = date.getFullYear().toString().slice(-2) +
        (date.getMonth() + 1).toString().padStart(2, '0') +
        date.getDate().toString().padStart(2, '0');

    if (dateStr === lastDateStr) {
        sequence++;
    } else {
        lastDateStr = dateStr;
        sequence = 1;
    }
    return `Q${dateStr}-${sequence.toString().padStart(3, '0')}`;
}

async function migrate() {
    console.log('Starting migration...');

    try {
        // 1. JSONデータの読み込み
        const quotations = JSON.parse(fs.readFileSync(path.join(OLD_DATA_DIR, 'quotations.json'), 'utf8'));
        console.log(`Loaded ${quotations.length} quotations from JSON.`);

        // 作成日順にソート（ID採番のため）
        quotations.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        for (const oldQ of quotations) {
            const isOriginalIdUuid = typeof oldQ.id === 'string' && oldQ.id.length === 36;
            const newId = isOriginalIdUuid ? oldQ.id : crypto.randomUUID();

            // display_id の決定: もし元のIDがQ形式ならそれを使う、そうでなければ生成する
            const displayId = (typeof oldQ.id === 'string' && oldQ.id.startsWith('Q'))
                ? oldQ.id
                : generateNewQuotationId(oldQ.createdAt);

            // 1-0. 重複チェック（再開可能にするため）
            // IDまたはdisplay_idで存在を確認する
            const { data: existingQ } = await supabase
                .from('quotations')
                .select('id, display_id')
                .eq('tenant_id', TARGET_TENANT_ID)
                .or(`id.eq.${newId},display_id.eq.${displayId}`)
                .maybeSingle();

            if (existingQ) {
                console.log(`  - Skipping: ${displayId} (Already exists in DB with ID: ${existingQ.id})`);
                continue;
            }

            console.log(`Migrating: ${oldQ.id} -> ${displayId} (PK: ${newId}) [${oldQ.companyName}]`);

            // 1-1. Quotation メイン (重複衝突時のリトライロジック付き)
            let success = false;
            let suffix = 0;
            let finalDisplayId = displayId;

            while (!success) {
                const { error: qError } = await supabase.from('quotations').insert({
                    id: newId,
                    display_id: finalDisplayId,
                    tenant_id: TARGET_TENANT_ID,
                    company_name: oldQ.companyName || '',
                    contact_person: oldQ.contactPerson || '',
                    email_link: oldQ.emailLink || '',
                    notes: oldQ.notes || '',
                    order_number: oldQ.orderNumber || '',
                    construction_number: oldQ.constructionNumber || '',
                    status: oldQ.status || 'pending',
                    created_at: oldQ.createdAt,
                    updated_at: oldQ.updatedAt || oldQ.createdAt,
                    is_deleted: oldQ.isDeleted || false,
                    deleted_at: oldQ.deletedAt || null
                });

                if (qError) {
                    if (qError.code === '23505' && qError.details.includes('display_id')) {
                        // display_id が重複した場合は、サフィックスを付けてリトライ
                        suffix++;
                        finalDisplayId = `${displayId}-${suffix}`;
                        console.log(`    - Display ID collision. Retrying with: ${finalDisplayId}`);
                        continue;
                    }
                    throw qError;
                }
                success = true;
            }

            // 1-2. Quotation Items
            if (oldQ.items && oldQ.items.length > 0) {
                const itemsToInsert = oldQ.items.map((item, index) => {
                    // 子要素のID重複による停止を防ぐため、常に新しいUUIDを発行する
                    const itemId = crypto.randomUUID();
                    return {
                        id: itemId,
                        quotation_id: newId,
                        tenant_id: TARGET_TENANT_ID,
                        sort_order: index,
                        name: item.name || '',
                        quantity: parseFloat(item.quantity) || 0,
                        processing_cost: parseFloat(item.processingCost) || 0,
                        material_cost: parseFloat(item.materialCost) || 0,
                        other_cost: parseFloat(item.otherCost) || 0,
                        response_date: item.responseDate || null,
                        due_date: item.dueDate || null,
                        delivery_date: item.deliveryDate || null,
                        scheduled_start_date: item.scheduledStartDate || null,
                        actual_hours: parseFloat(item.actualHours) || 0,
                        actual_processing_cost: parseFloat(item.actualProcessingCost) || 0,
                        actual_material_cost: parseFloat(item.actualMaterialCost) || 0,
                        actual_other_cost: parseFloat(item.actualOtherCost) || 0,
                        actual_mode: item._actualMode || 'amount'
                    };
                });

                const { error: itemsError } = await supabase.from('quotation_items').insert(itemsToInsert);
                if (itemsError) throw itemsError;
                console.log(`  - Migrated ${itemsToInsert.length} items.`);
            }

            // 1-3. Files & Vector Generation
            if (oldQ.files && oldQ.files.length > 0) {
                for (const oldFile of oldQ.files) {
                    const localFileName = path.basename(oldFile.path);
                    const localFilePath = path.join(OLD_UPLOADS_DIR, localFileName);

                    if (!fs.existsSync(localFilePath)) {
                        console.warn(`  - File not found locally: ${localFileName}`);
                        continue;
                    }

                    const fileBuffer = fs.readFileSync(localFilePath);
                    // ファイルIDも常に新しいUUIDにする（重複回避）
                    const fileHandle = crypto.randomUUID();
                    const ext = path.extname(localFileName);
                    const storagePath = `${TARGET_TENANT_ID}/${newId}/${fileHandle}${ext}`;
                    const mimeType = ext.toLowerCase() === '.pdf' ? 'application/pdf' : 'application/octet-stream';

                    // Storageアップロード
                    console.log(`  - Uploading file: ${oldFile.originalName}`);
                    const { error: uploadError } = await supabase.storage
                        .from('quotation-files')
                        .upload(storagePath, fileBuffer, {
                            contentType: mimeType,
                            upsert: true
                        });

                    if (uploadError) {
                        console.error(`  - Upload failed for ${oldFile.originalName}:`, uploadError.message);
                        continue;
                    }

                    // DB登録
                    const { error: dbFileError } = await supabase.from('quotation_files').insert({
                        id: fileHandle,
                        quotation_id: newId,
                        tenant_id: TARGET_TENANT_ID,
                        storage_path: storagePath,
                        original_name: oldFile.originalName,
                        file_hash: calculateHash(localFilePath),
                        file_size: fileBuffer.length,
                        mime_type: mimeType,
                        file_type: oldFile.originalName.toLowerCase().includes('図面') || oldFile.originalName.toLowerCase().includes('制作図') ? 'drawing' : 'attachment'
                    });

                    if (dbFileError) throw dbFileError;

                    // ベクトル生成 (PDFの場合のみ)
                    if (mimeType === 'application/pdf') {
                        console.log(`  - Generating vector for: ${oldFile.originalName}...`);
                        try {
                            // APIのレート制限を考慮して待つ必要があるかもしれないが、まずは順次実行
                            await drawingSearchService.registerDrawing(newId, fileHandle, TARGET_TENANT_ID, fileBuffer, mimeType);
                            console.log(`    - Vector generated.`);
                            // レート制限緩和のためのスリープ (1秒)
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        } catch (vecErr) {
                            console.error(`    - Vector generation failed for ${oldFile.originalName}:`, vecErr.message);
                        }
                    }
                }
            }
        }

        console.log('Migration finished successfully.');

    } catch (err) {
        console.error('Migration failed:', err.message);
        console.error(err);
    }
}

migrate();
