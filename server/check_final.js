require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function checkFinalStatus() {
    try {
        const fileId = '2a1f7060-00ee-4c1b-a88e-7a916a841f0b';
        const { data: file, error: fileErr } = await supabaseAdmin
            .from('quotation_files')
            .select('id, original_name')
            .eq('id', fileId)
            .single();
        
        if (fileErr) throw fileErr;

        const { count, error: countErr } = await supabaseAdmin
            .from('drawing_tiles')
            .select('*', { count: 'exact', head: true })
            .eq('file_id', fileId);
        
        console.log(`Final Status for ${file.original_name}:`);
        console.log(`  Tiles: ${countErr ? 'Error' : count}`);

        // 最近のタイル全体も確認
        const { data: recentTiles } = await supabaseAdmin
            .from('drawing_tiles')
            .select('file_id, count(*)')
            .group('file_id')
            .limit(5);
        console.log('Recent tile counts by file:', recentTiles);

    } catch (e) {
        console.error(e);
    }
}

checkFinalStatus();
