require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function checkEmptyDrawings() {
    console.log('--- Checking for drawings with 0 tiles ---');
    
    // 全ての図面ファイル（application/pdf）を取得
    const { data: files, error: fileError } = await supabaseAdmin
        .from('quotation_files')
        .select('id, original_name, quotation_id')
        .eq('mime_type', 'application/pdf');

    if (fileError) {
        console.error('Error fetching files:', fileError);
        return;
    }

    console.log(`Total PDF files: ${files.length}`);

    const emptyFiles = [];

    for (const file of files) {
        // 各ファイルに対応するタイル数をカウント
        const { count, error: countError } = await supabaseAdmin
            .from('drawing_tiles')
            .select('*', { count: 'exact', head: true })
            .eq('file_id', file.id);

        if (countError) {
            console.error(`Error counting tiles for ${file.id}:`, countError);
            continue;
        }

        if (count === 0) {
            emptyFiles.push({
                id: file.id,
                name: file.original_name,
                quotation_id: file.quotation_id
            });
        }
    }

    if (emptyFiles.length === 0) {
        console.log('No empty drawings found! All PDFs have at least one tile.');
    } else {
        console.log(`Found ${emptyFiles.length} drawings with 0 tiles:`);
        console.table(emptyFiles);
    }
}

checkEmptyDrawings();
