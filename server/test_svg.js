require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function testSVG() {
    const fileId = '96443dad-4bfc-41f6-9c17-48f1ddf14f68'; // カツ-2689.pdf
    console.log(`--- Testing SVG Backend for: ${fileId} ---`);

    try {
        const { data: file } = await supabaseAdmin.from('quotation_files').select('*').eq('id', fileId).single();
        const { data: dl } = await supabaseAdmin.storage.from('quotation-files').download(file.storage_path);
        const buffer = Buffer.from(await dl.arrayBuffer());

        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const { SVGGraphics } = await import('pdfjs-dist/legacy/build/pdf.mjs');
        
        // CMap等
        const cMapUrl = `file://${path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'cmaps').replace(/\\/g, '/')}/`;

        const loadingTask = pdfjs.getDocument({ 
            data: new Uint8Array(buffer), 
            cMapUrl, 
            cMapPacked: true,
            disableFontFace: true
        });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });

        // SVGエニュメレータ (Node.js環境では DOM がないので JSDOM 等が必要な場合がある)
        // しかし、pdfjs-dist の SVGGraphics は内部で DOM を使う
        // 代わりに、operatorList を取得して自分で解析するか、JSDOM を使う
        
        const operatorList = await page.getOperatorList();
        console.log(`Operator List Length: ${operatorList.fnArray.length}`);
        
        // オペレーターリストをチェック (インライン画像があるか)
        const ops = operatorList.fnArray;
        const paintImageOps = ops.filter(op => op === pdfjs.OPS.paintImageXObject || op === pdfjs.OPS.paintImageMaskXObject || op === pdfjs.OPS.paintInlineImageXObject);
        console.log(`Image-related Operators found: ${paintImageOps.length}`);
        
        if (paintImageOps.length === 0) {
            console.log('  -> No image operators found in OperatorList either.');
        } else {
            console.log('  -> Found image operators!');
        }

    } catch (err) {
        console.error(`ERROR:`, err.message);
    }
}

testSVG();
