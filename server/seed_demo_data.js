require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PDFDocument } = require('pdf-lib');
const { supabaseAdmin } = require('./src/config/supabase');
const drawingSearchService = require('./src/services/ai/drawingSearchService');

const TENANT_ID = 'c94934bf-d5b4-4e94-8987-60d07db7c022'; // 正木鉄工株式会社
const USER_ID = '33265450-f44f-436d-99bc-d7a7fefba62a';   // masakitekkou@outlook.jp

const samples = [
    {
        name: 'フランジ部品 A-202',
        company: 'サンプル工業株式会社',
        imagePath: 'C:\\Users\\正木鉄工\\.gemini\\antigravity\\brain\\e2471f41-63eb-478c-bdd8-fd96ac0e0d65\\demo_drawing_flange_white_1773732900361.png',
        filename: 'drawing_flange_A202.pdf',
        file_type: 'drawing',
        status: 'ordered',
        processing_cost: 15600,
        material_cost: 4200
    },
    {
        name: '部品発注注文書 (1773731620)',
        company: 'サンプル工業株式会社',
        imagePath: 'C:\\Users\\正木鉄工\\.gemini\\antigravity\\brain\\e2471f41-63eb-478c-bdd8-fd96ac0e0d65\\demo_purchase_order_1773731620364.png',
        filename: 'purchase_order_20260317.pdf',
        file_type: 'attachment', // 注文書は添付ファイル扱い
        status: 'ordered',
        processing_cost: 0,
        material_cost: 0
    }
];

async function seed() {
    console.log('[Seed] Starting demo data injection to localhost...');

    for (const s of samples) {
        try {
            if (!fs.existsSync(s.imagePath)) {
                console.error(`[Seed] File not found: ${s.imagePath}`);
                continue;
            }

            // 1. Quotation作成
            const { data: quotation, error: qError } = await supabaseAdmin
                .from('quotations')
                .insert({
                    tenant_id: TENANT_ID,
                    company_name: s.company,
                    display_id: 'DEMO-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
                    created_by: USER_ID,
                    status: s.status, // s.status を使用
                    notes: 'デモ用サンプルデータ'
                })
                .select()
                .single();

            if (qError) throw qError;
            console.log(`[Seed] Created quotation: ${quotation.display_id} for ${s.name}`);

            if (s.processing_cost > 0) {
                // 明細追加
                await supabaseAdmin.from('quotation_items').insert({
                    quotation_id: quotation.id,
                    tenant_id: TENANT_ID,
                    name: s.name,
                    processing_cost: s.processing_cost,
                    material_cost: s.material_cost,
                    quantity: 1
                });
            }

            // 2. PNGをPDFに変換
            console.log(`[Seed] Converting PNG to PDF: ${s.filename}`);
            const pngBuffer = fs.readFileSync(s.imagePath);
            const pdfDoc = await PDFDocument.create();
            const pngImage = await pdfDoc.embedPng(pngBuffer);
            const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
            page.drawImage(pngImage, { x: 0, y: 0, width: pngImage.width, height: pngImage.height });
            const pdfBytes = await pdfDoc.save();

            // 3. Storageアップロード
            const fileId = uuidv4();
            const storagePath = `${TENANT_ID}/${quotation.id}/${fileId}.pdf`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from('quotation-files')
                .upload(storagePath, pdfBytes, { contentType: 'application/pdf' });

            if (uploadError) throw uploadError;

            // 4. DB登録
            const { data: fileRecord, error: fError } = await supabaseAdmin
                .from('quotation_files')
                .insert({
                    id: fileId,
                    quotation_id: quotation.id,
                    tenant_id: TENANT_ID,
                    storage_path: storagePath,
                    original_name: s.filename,
                    file_size: pdfBytes.length,
                    mime_type: 'application/pdf',
                    file_type: s.file_type
                })
                .select()
                .single();

            if (fError) throw fError;

            // 5. Drawingの場合は Indexing (Search Vectoring)
            if (s.file_type === 'drawing') {
                console.log(`[Seed] Indexing drawing search vectors...`);
                await drawingSearchService.registerDrawing(quotation.id, fileId, TENANT_ID, pngBuffer, 'image/png');
            }

            console.log(`[Seed] Successfully seeded: ${s.name}`);
        } catch (err) {
            console.error(`[Seed] Error processing ${s.name}:`, err);
        }
    }

    console.log('[Seed] Finished. Registered to localhost (Supabase Dev).');
}

seed();
