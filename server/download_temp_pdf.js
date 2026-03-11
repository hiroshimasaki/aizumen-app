require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');
const fs = require('fs');
const path = require('path');

async function downloadPDF() {
    const fileId = '96443dad-4bfc-41f6-9c17-48f1ddf14f68';
    const storagePath = 'c94934bf-d5b4-4e94-8987-60d07db7c022/a3114d4a-c2d8-43ae-82f6-a500afc53e30/96443dad-4bfc-41f6-9c17-48f1ddf14f68.pdf';
    
    try {
        const { data, error } = await supabaseAdmin.storage
            .from('quotation-files')
            .download(storagePath);
        if (error) throw error;
        
        const buffer = Buffer.from(await data.arrayBuffer());
        const localPath = path.join(process.cwd(), 'temp_katsu_2689.pdf');
        fs.writeFileSync(localPath, buffer);
        console.log(`Saved to: ${localPath} (${buffer.length} bytes)`);
    } catch (err) {
        console.error(`ERROR:`, err.message);
    }
}

downloadPDF();
