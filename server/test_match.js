require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function testSearchMatch() {
    try {
        const fileId = '2a1f7060-00ee-4c1b-a88e-7a916a841f0b';
        
        // 1. ファイルとタイルの確認
        const { data: file } = await supabaseAdmin
            .from('quotation_files')
            .select('tenant_id')
            .eq('id', fileId)
            .single();
        
        const { data: tiles } = await supabaseAdmin
            .from('drawing_tiles')
            .select('embedding')
            .eq('file_id', fileId)
            .limit(1);

        if (!tiles || tiles.length === 0) {
            console.log('No tiles found for this file.');
            return;
        }

        const queryEmbedding = JSON.parse(tiles[0].embedding);
        console.log('Using tile embedding as query. Tenant ID:', file.tenant_id);

        // 2. RPC を手動で叩いてみる
        const { data: results, error } = await supabaseAdmin.rpc('match_drawing_tiles', {
            query_embedding: queryEmbedding,
            match_threshold: 0.3,
            match_count: 10,
            p_tenant_id: file.tenant_id
        });

        if (error) throw error;

        console.log('--- Search Results from DB (Self-match test) ---');
        const found = results.find(r => r.file_id === fileId);
        if (found) {
            console.log(`Success! File ${fileId} found in search results.`);
            console.log(`  Similarity: ${found.similarity}`);
        } else {
            console.log(`Failed. File ${fileId} NOT found in top 10 results.`);
            console.log('Results were:', results.map(r => ({ id: r.file_id, sim: r.similarity })));
        }

    } catch (e) {
        console.error(e);
    }
}

testSearchMatch();
