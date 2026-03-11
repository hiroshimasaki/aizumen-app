require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function inspectPDF() {
    const fileId = 'af68810a-04e9-4c23-9648-01be65de7e1a'; // スペーサー図面.pdf
    console.log(`--- Inspecting PDF Objects: ${fileId} ---`);

    try {
        const { data: file } = await supabaseAdmin.from('quotation_files').select('*').eq('id', fileId).single();
        const { data: dl } = await supabaseAdmin.storage.from('quotation-files').download(file.storage_path);
        const buffer = Buffer.from(await dl.arrayBuffer());

        const pdfDoc = await PDFDocument.load(buffer);
        const pages = pdfDoc.getPages();
        console.log(`Total Pages: ${pages.length}`);

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const { width, height } = page.getSize();
            console.log(`Page ${i + 1}: ${width} x ${height}`);
            
            // XObject (Images) を探す
            const resources = page.node.Resources();
            if (resources) {
                const xObjects = resources.get(require('pdf-lib').PDFName.of('XObject'));
                if (xObjects) {
                    const keys = xObjects.keys();
                    console.log(`  Found ${keys.length} XObjects`);
                    for (const key of keys) {
                        const obj = xObjects.get(key);
                        const subtype = obj.get(require('pdf-lib').PDFName.of('Subtype'));
                        if (subtype && subtype.decodeText() === 'Image') {
                            const w = obj.get(require('pdf-lib').PDFName.of('Width'));
                            const h = obj.get(require('pdf-lib').PDFName.of('Height'));
                            const filter = obj.get(require('pdf-lib').PDFName.of('Filter'));
                            console.log(`    - IMAGE: ${key.decodeText()}, Size: ${w}x${h}, Filter: ${filter}`);
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error(`ERROR:`, err.message);
    }
}

inspectPDF();
