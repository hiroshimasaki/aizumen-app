require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function checkDuplicates() {
    try {
        const { data, error } = await supabaseAdmin.rpc('list_duplicate_hashes');
        // もしRPCがなければクエリで代用
        if (error) {
            const { data: files, error: filesError } = await supabaseAdmin
                .from('quotation_files')
                .select('page_hash, original_name, id')
                .not('page_hash', 'is', null);
            
            if (filesError) throw filesError;

            const hashGroups = {};
            files.forEach(f => {
                if (!hashGroups[f.page_hash]) hashGroups[f.page_hash] = [];
                hashGroups[f.page_hash].push(f);
            });

            console.log('Duplicate Hashes found:');
            Object.entries(hashGroups).forEach(([hash, group]) => {
                if (group.length > 1) {
                    console.log(`Hash: ${hash} (${group.length} files)`);
                    group.forEach(f => console.log(`  - ${f.original_name} (${f.id})`));
                }
            });
        }
    } catch (err) {
        console.error('Check failed:', err.message);
    }
}

checkDuplicates();
