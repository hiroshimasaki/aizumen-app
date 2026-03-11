require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');
const crypto = require('crypto');

async function checkHash() {
    const fileId = '96443dad-4bfc-41f6-9c17-48f1ddf14f68'; // カツ-2689.pdf
    console.log(`--- Checking MD5 Hash for: ${fileId} ---`);

    try {
        const { data: file } = await supabaseAdmin.from('quotation_files').select('storage_path').eq('id', fileId).single();
        const { data: dl } = await supabaseAdmin.storage.from('quotation-files').download(file.storage_path);
        const buffer = Buffer.from(await dl.arrayBuffer());

        const hash = crypto.createHash('md5').update(buffer).digest('hex');
        console.log(`MD5: ${hash}`);
        console.log(`Size: ${buffer.length} bytes`);

        // 同一ハッシュのファイルを検索 (もし hash カラムがあれば)
        // 今回はファイル全件取得してMD5計算するのは重いので、 일단 hashを表示
    } catch (err) {
        console.error(`ERROR:`, err.message);
    }
}

checkHash();
