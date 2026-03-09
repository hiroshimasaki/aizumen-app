const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PDFDocument } = require('pdf-lib');
const { supabaseAdmin } = require('../src/config/supabase');
const drawingSearchService = require('../src/services/ai/drawingSearchService');

const TENANT_ID = 'c94934bf-d5b4-4e94-8987-60d07db7c022';
const USER_ID = '33265450-f44f-436d-99bc-d7a7fefba62a';

const samples = [
    {
        name: '六角ボルト・ナット図面',
        company: 'サンプル工業株式会社',
        path: 'C:\\Users\\正木鉄工\\.gemini\\antigravity\\brain\\55e30344-b312-4fd7-a6cd-db3617228faa\\sample_bolt_drawing_1773031896108.png',
        filename: 'sample_bolt.pdf',
        processing_cost: 1500,
        material_cost: 800
    },
    {
        name: '配管フランジ 8穴',
        company: '株式会社デモプラント',
        path: 'C:\\Users\\正木鉄工\\.gemini\\antigravity\\brain\\55e30344-b312-4fd7-a6cd-db3617228faa\\sample_flange_drawing_1773031909427.png',
        filename: 'sample_flange.pdf',
        processing_cost: 12000,
        material_cost: 5000
    },
    {
        name: '取付プレート A型',
        company: 'テスト精密',
        path: 'C:\\Users\\正木鉄工\\.gemini\\antigravity\\brain\\55e30344-b312-4fd7-a6cd-db3617228faa\\sample_plate_drawing_1773031922457.png',
        filename: 'sample_plate.pdf',
        processing_cost: 4500,
        material_cost: 2100
    }
];

async function seed() {
    console.log('[Seed] Starting sample data injection...');

    for (const s of samples) {
        try {
            if (!fs.existsSync(s.path)) {
                console.error(`[Seed] File not found: ${s.path}`);
                continue;
            }

            // 1. Quotation作成
            const { data: quotation, error: qError } = await supabaseAdmin
                .from('quotations')
                .insert({
                    tenant_id: TENANT_ID,
                    company_name: s.company,
                    display_id: 'SAMPLE-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
                    created_by: USER_ID,
                    status: 'ordered',
                    notes: 'サンプルデータ'
                })
                .select()
                .single();

            if (qError) throw qError;
            console.log(`[Seed] Created quotation: ${quotation.display_id}`);

            // 明細追加
            await supabaseAdmin.from('quotation_items').insert({
                quotation_id: quotation.id,
                tenant_id: TENANT_ID,
                name: s.name,
                processing_cost: s.processing_cost,
                material_cost: s.material_cost,
                quantity: 1
            });

            // 2. PNGをPDFに変換
            console.log(`[Seed] Converting PNG to PDF: ${s.filename}`);
            const pngBuffer = fs.readFileSync(s.path);
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
                    file_type: 'drawing'
                })
                .select()
                .single();

            if (fError) throw fError;

            // 5. Indexing (Search Vectoring)
            console.log(`[Seed] Registering drawing search vectors using original image buffer...`);
            await drawingSearchService.registerDrawing(quotation.id, fileId, TENANT_ID, pngBuffer);

            console.log(`[Seed] Successfully seeded: ${s.name}`);
        } catch (err) {
            console.error(`[Seed] Error processing ${s.name}:`, err);
        }
    }

    console.log('[Seed] Finished.');
}

seed();
