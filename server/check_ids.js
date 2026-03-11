require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');
const ids = [
    'c554ccfb-3996-4aea-b50b-38d2772b3ac5',
    '464f4bb2-9170-46cc-ab40-9a91a4282bcf',
    'a4fbd07e-9e8d-4878-b688-f722e513d7fe',
    '9a9aaa07-7bd5-42c8-95f7-b7a73ea31a0f',
    '03018209-4931-4b92-8cf0-00e9acfeaa7d'
];

async function main() {
    const { data, error } = await supabaseAdmin
        .from('quotation_files')
        .select('id, original_name')
        .in('id', ids);
    
    if (error) {
        console.error(error);
        return;
    }
    
    console.log('--- Candidate Mapping ---');
    data.forEach(f => {
        console.log(`${f.id} -> ${f.original_name}`);
    });
}

main();
