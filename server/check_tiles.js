require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function main() {
    // 1. ファイルIDの特定
    const { data: file, error: fileError } = await supabaseAdmin
        .from('quotation_files')
        .select('id, tenant_id')
        .like('original_name', '%カツ-2689%')
        .single();
    
    if (fileError) {
        console.error('File found error:', fileError);
        return;
    }
    
    console.log(`Found file: ${file.id} (Tenant: ${file.tenant_id})`);

    // 2. タイル数の確認
    const { count, error: countError } = await supabaseAdmin
        .from('drawing_tiles')
        .select('*', { count: 'exact', head: true })
        .eq('file_id', file.id);
    
    if (countError) {
        console.error('Count error:', countError);
    }
    console.log(`Tile count: ${count}`);

    // 3. ベクトルの存在確認
    const { data: tiles, error: tileError } = await supabaseAdmin
        .from('drawing_tiles')
        .select('tile_index')
        .eq('file_id', file.id)
        .limit(5);
    
    if (tileError) {
        console.error('Tile fetch error:', tileError);
    }
    
    tiles.forEach((t, i) => {
        const hasIdx = t.tile_index !== null;
        console.log(`Tile ${i}: has vector? ${hasIdx} (Length: ${hasIdx ? '?' : '0'})`);
    });
}

main();
