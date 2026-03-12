require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testStorage() {
    const bucketName = 'quotation-files';
    const testFile = 'test_mime_type.png';
    const content = Buffer.from('test content');

    const mimeTypes = ['image/webp', 'application/octet-stream', 'image/png'];
    
    for (const mime of mimeTypes) {
        console.log(`Testing upload with contentType: ${mime}...`);
        const { error } = await supabase.storage
            .from(bucketName)
            .upload(`test_${mime.replace(/\//g, '_')}.tmp`, content, {
                contentType: mime,
                upsert: true
            });

        if (error) {
            console.error(`  Result for ${mime}: FAILED (${error.message})`);
        } else {
            console.log(`  Result for ${mime}: SUCCESS!`);
            await supabase.storage.from(bucketName).remove([`test_${mime.replace(/\//g, '_')}.tmp`]);
        }
    }
}

testStorage();
