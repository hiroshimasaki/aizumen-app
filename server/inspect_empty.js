require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function checkEmptyFiles() {
    try {
        const fileIds = [
            'e374c7e3-5ddf-416d-aa24-d01f7bee339e',
            '62a72b87-7cb2-4586-af5c-7c3c8784dbb4'
        ];

        console.log('--- Inspecting Empty Indexed Files ---');
        const { data: files, error } = await supabaseAdmin
            .from('quotation_files')
            .select('id, original_name, mime_type, file_size')
            .in('id', fileIds);
        
        if (error) throw error;

        for (const file of files) {
            console.log(`File: ${file.original_name}`);
            console.log(`  MIME: ${file.mime_type}`);
            console.log(`  Size: ${file.file_size} bytes`);
        }

    } catch (e) {
        console.error('Check failed:', e);
    }
}

checkEmptyFiles();
