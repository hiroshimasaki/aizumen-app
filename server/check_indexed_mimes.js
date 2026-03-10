require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function checkIndexedMimes() {
    try {
        const { data, error } = await supabaseAdmin.rpc('get_indexed_mimes');
        
        if (error) {
            // RPCがない場合は手動で集計
            const { data: tiles, error: tileErr } = await supabaseAdmin
                .from('drawing_tiles')
                .select('file_id')
                .limit(100);
            
            if (tileErr) throw tileErr;
            const fileIds = [...new Set(tiles.map(t => t.file_id))];
            
            const { data: files } = await supabaseAdmin
                .from('quotation_files')
                .select('mime_type')
                .in('id', fileIds);
            
            const mimes = [...new Set(files.map(f => f.mime_type))];
            console.log('Indexed MIME types (sample):', mimes);
        } else {
            console.log('Indexed MIME types:', data);
        }
    } catch (e) {
        console.error(e);
    }
}
checkIndexedMimes();
