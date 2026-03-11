require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');
const sharp = require('sharp');
const fs = require('fs');
const { JSDOM } = require('jsdom');

async function testPdfToSvg() {
    const fileId = '96443dad-4bfc-41f6-9c17-48f1ddf14f68'; // カツ-2689.pdf
    console.log(`--- PDF to SVG POC for: ${fileId} ---`);

    try {
        const { data: fileMeta } = await supabaseAdmin.from('quotation_files').select('storage_path').eq('id', fileId).single();
        const { data: dl } = await supabaseAdmin.storage.from('quotation-files').download(fileMeta.storage_path);
        const buffer = Buffer.from(await dl.arrayBuffer());

        // ESM import
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

        const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
        const nodeDoc = dom.window.document;

        const loadingTask = pdfjs.getDocument({
            data: new Uint8Array(buffer),
            nativeImageDecoderSupport: 'none',
            disableFontFace: true
        });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        const viewport = page.getViewport({ scale: 2.0 });
        
        const opList = await page.getOperatorList();
        const svgGfx = new pdfjs.SVGGraphics(page.commonObjs, page.objs);
        svgGfx.embedFonts = false; 
        
        const svgElement = await svgGfx.getSVG(opList, viewport);
        
        // svgElement は JSDOM の要素
        const svgString = svgElement.outerHTML;
        console.log(`SVG String Length: ${svgString.length}`);
        
        const pngBuffer = await sharp(Buffer.from(svgString))
            .flatten({ background: '#ffffff' })
            .png()
            .toBuffer();
        
        console.log(`PNG Buffer Size: ${pngBuffer.length} bytes`);
        fs.writeFileSync('katsu_2689_svg_poc.png', pngBuffer);
        
        const stats = await sharp(pngBuffer).stats();
        console.log(`Stats - Mean: ${stats.channels[0].mean}, Min: ${stats.channels[0].min}`);

    } catch (err) {
        console.error('POC Error:', err);
    }
}

testPdfToSvg();
