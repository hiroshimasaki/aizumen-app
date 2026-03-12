require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { preprocessImage } = require('../src/services/ai/imageService');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Error: Environment variables SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are not set.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function generateAllThumbnails() {
    console.log('--- Thumbnail Generation Start ---');

    // 1. 全ての quotatiton_files を取得
    const { data: files, error } = await supabase
        .from('quotation_files')
        .select('id, storage_path, mime_type')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Failed to fetch files:', error);
        return;
    }

    console.log(`Found ${files.length} files to process.`);

    for (const file of files) {
        const thumbnailPath = `thumbnails/${file.id}.png`;

        // すでに存在するかチェック
        const { data: existing } = await supabase.storage
            .from('quotation-files')
            .list('thumbnails', { search: `${file.id}.png` });

        if (existing && existing.length > 0) {
            console.log(`[Skip] Thumbnail already exists for ${file.id}`);
            continue;
        }

        console.log(`[Process] Generating thumbnail for ${file.id} (${file.original_name || file.storage_path})`);

        try {
            // 元ファイルをダウンロード
            const { data: fileData, error: dlError } = await supabase.storage
                .from('quotation-files')
                .download(file.storage_path);

            if (dlError || !fileData) {
                console.error(`  [Error] Download failed for ${file.id}:`, dlError?.message);
                continue;
            }

            const buffer = Buffer.from(await fileData.arrayBuffer());
            
            // 画像化 (1ページ目)
            const processedBuffer = await preprocessImage(buffer, file.mime_type);

            // 保存
            const { error: ulError } = await supabase.storage
                .from('quotation-files')
                .upload(thumbnailPath, processedBuffer, {
                    contentType: 'image/png',
                    upsert: true
                });

            if (ulError) {
                console.error(`  [Error] Upload failed for ${file.id}:`, ulError.message);
            } else {
                console.log(`  [Success] Thumbnail created.`);
            }
        } catch (err) {
            console.error(`  [Fatal] Processing failed for ${file.id}:`, err.message);
        }
    }

    console.log('--- Thumbnail Generation Finished ---');
}

generateAllThumbnails();
