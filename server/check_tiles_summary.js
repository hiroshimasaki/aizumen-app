require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function getIndexingSummary() {
    try {
        console.log('--- Drawing Indexing Summary ---');
        console.log('Fetching data from database...');

        // 全ての見積とそれに関連付けられたタイル数を取得
        const { data: quotations, error: qError } = await supabaseAdmin
            .from('quotations')
            .select('id, company_name, display_id');

        if (qError) throw qError;

        const { data: tiles, error: tError } = await supabaseAdmin
            .from('drawing_tiles')
            .select('quotation_id');

        if (tError) throw tError;

        // 各見積ごとのタイル数を集計
        const tileCounts = {};
        tiles.forEach(tile => {
            tileCounts[tile.quotation_id] = (tileCounts[tile.quotation_id] || 0) + 1;
        });

        // ファイル情報を取得（quotation_filesから）
        const { data: files, error: fError } = await supabaseAdmin
            .from('quotation_files')
            .select('quotation_id, original_name');

        if (fError) throw fError;

        const fileMap = {};
        files.forEach(f => {
            if (!fileMap[f.quotation_id]) {
                fileMap[f.quotation_id] = [];
            }
            fileMap[f.quotation_id].push(f.original_name);
        });

        console.log('\n| Quotation ID | Company | File Name | Tile Count |');
        console.log('|--------------|---------|-----------|------------|');

        let totalFiles = 0;
        let totalTiles = 0;

        quotations.forEach(q => {
            const count = tileCounts[q.id] || 0;
            const filenames = fileMap[q.id] || ['(No file)'];
            
            filenames.forEach(fname => {
                console.log(`| ${q.id.substring(0,8)}... | ${q.company_name || 'N/A'} | ${fname} | ${count} |`);
            });

            if (count > 0) {
                totalFiles += filenames.length;
                totalTiles += count;
            }
        });

        console.log('\n--- Totals ---');
        console.log(`Indexed Files: ${totalFiles}`);
        console.log(`Total Tiles Generated: ${totalTiles}`);
        console.log('---------------');

    } catch (err) {
        console.error('Error generating summary:', err.message);
    }
}

getIndexingSummary();
