require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');
const { PDFDocument } = require('pdf-lib');

async function checkTenantPDFs() {
    const tenantId = 'c94934bf-d5b4-4e94-8987-60d07db7c022';
    console.log(`--- Checking Tenant PDFs for XObjects ---`);
    
    const { data: files } = await supabaseAdmin
        .from('quotation_files')
        .select('id, original_name, storage_path')
        .eq('tenant_id', tenantId)
        .ilike('mime_type', '%pdf%');

    for (const file of files) {
        const { count } = await supabaseAdmin.from('drawing_tiles').select('*', { count: 'exact', head: true }).eq('file_id', file.id);
        
        if (count === 0) {
            try {
                const { data: dl } = await supabaseAdmin.storage.from('quotation-files').download(file.storage_path);
                const buffer = Buffer.from(await dl.arrayBuffer());
                const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
                const page = pdfDoc.getPages()[0];
                const resources = page.node.Resources();
                const xObjects = resources ? resources.get(require('pdf-lib').PDFName.of('XObject')) : null;
                const xCount = xObjects ? xObjects.keys().length : 0;
                
                console.log(`File: ${file.original_name}, Tiles: ${count}, XObjects: ${xCount}`);
            } catch (e) {
                console.log(`File: ${file.original_name}, Tiles: ${count}, Error: ${e.message}`);
            }
        }
    }
}

checkTenantPDFs();
