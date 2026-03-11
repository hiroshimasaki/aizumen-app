require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');
const sharp = require('sharp');
const fs = require('fs');

// Minimal Mock DOM for PDF.js SVGGraphics
class MockElement {
    constructor(name, ns) {
        this.name = name;
        this.ns = ns;
        this.attributes = {};
        this.children = [];
        this.style = {};
        this.textContent = '';
    }
    setAttribute(k, v) { this.attributes[k] = v; }
    setAttributeNS(ns, k, v) { this.attributes[k] = v; }
    appendChild(c) { this.children.push(c); }
    get outerHTML() {
        const attrs = Object.entries(this.attributes).map(([k, v]) => `${k}="${v}"`).join(' ');
        if (this.name === 'svg:svg' || this.name === 'svg') {
            const inner = this.children.map(c => c.outerHTML).join('');
            return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ${attrs}>${inner}</svg>`;
        }
        const inner = this.children.map(c => c.outerHTML).join('') || this.textContent;
        return `<${this.name} ${attrs}>${inner}</${this.name}>`;
    }
}

const mockDoc = {
    createElementNS: (ns, name) => new MockElement(name, ns),
    createElement: (name) => new MockElement(name)
};

async function testPdfToSvgMock() {
    const fileId = '96443dad-4bfc-41f6-9c17-48f1ddf14f68'; 
    console.log(`--- PDF to SVG (MOCK DOM) for: ${fileId} ---`);

    try {
        const { data: fileMeta } = await supabaseAdmin.from('quotation_files').select('storage_path').eq('id', fileId).single();
        const { data: dl } = await supabaseAdmin.storage.from('quotation-files').download(fileMeta.storage_path);
        const buffer = Buffer.from(await dl.arrayBuffer());

        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

        const loadingTask = pdfjs.getDocument({
            data: new Uint8Array(buffer),
            nativeImageDecoderSupport: 'none',
            disableFontFace: true
        });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        const viewport = page.getViewport({ scale: 2.0, rotation: page.rotate });
        
        const opList = await page.getOperatorList();
        const svgGfx = new pdfjs.SVGGraphics(page.commonObjs, page.objs);
        svgGfx.embedFonts = false; 
        
        // Mock document を渡す
        const svgElement = await svgGfx.getSVG(opList, viewport, mockDoc);
        
        const svgString = svgElement.outerHTML;
        // console.log(`SVG Output (Short): ${svgString.substring(0, 200)}...`);
        
        const pngBuffer = await sharp(Buffer.from(svgString))
            .flatten({ background: '#ffffff' })
            .png()
            .toBuffer();
        
        console.log(`PNG Success: ${pngBuffer.length} bytes`);
        fs.writeFileSync('katsu_2689_svg_mock.png', pngBuffer);
        
        const stats = await sharp(pngBuffer).stats();
        console.log(`Stats - Mean: ${stats.channels[0].mean}, Min: ${stats.channels[0].min}`);

    } catch (err) {
        console.error('POC Error:', err);
    }
}

testPdfToSvgMock();
