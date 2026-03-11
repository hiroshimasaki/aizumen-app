require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function verifyFix() {
    const fileId = '96443dad-4bfc-41f6-9c17-48f1ddf14f68'; // カツ-2689.pdf
    console.log(`--- Verifying fix (Katsu Vector Check) for: ${fileId} ---`);

    try {
        const { data: file } = await supabaseAdmin.from('quotation_files').select('*').eq('id', fileId).single();
        const { data: dl } = await supabaseAdmin.storage.from('quotation-files').download(file.storage_path);
        const buffer = Buffer.from(await dl.arrayBuffer());

        const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const canvas = require('canvas');
        const cMapUrl = `file://${path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'cmaps').replace(/\\/g, '/')}/`;
        
        const loadingTask = getDocument({ 
            data: new Uint8Array(buffer), 
            cMapUrl,
            cMapPacked: true,
            disableFontFace: true,
            disableWorker: true
        });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.0, rotation: 0 });
        const c = canvas.createCanvas(viewport.width, viewport.height);
        const ctx = c.getContext('2d');

        // パッチ適用
        const originalDrawImage = ctx.drawImage;
        ctx.drawImage = function(img, ...args) {
            console.log(`[Debug] drawImage: style=${ctx.strokeStyle}, width=${ctx.lineWidth.toFixed(4)}, matrix=${JSON.stringify(ctx.getTransform())}`);
            // パッチ本体
            if (!(img instanceof canvas.Image || img instanceof canvas.Canvas) && typeof img === 'object') {
                const innerC = canvas.createCanvas(img.width, img.height);
                const innerCtx = innerC.getContext('2d');
                const idata = innerCtx.createImageData(img.width, img.height);
                idata.data.set(img.data);
                innerCtx.putImageData(idata, 0, 0);
                return originalDrawImage.apply(this, [innerC, ...args]);
            }
            return originalDrawImage.apply(this, [img, ...args]);
        };

        const originalStroke = ctx.stroke;
        ctx.stroke = function() {
            console.log(`[Debug] stroke: style=${ctx.strokeStyle}, width=${ctx.lineWidth.toFixed(4)}, matrix=${JSON.stringify(ctx.getTransform())}`);
            return originalStroke.apply(this);
        };

        await page.render({ 
            canvasContext: ctx, 
            viewport,
            canvasFactory: new (class {
                create(w, h) { return { canvas: canvas.createCanvas(w, h), context: canvas.createCanvas(w, h).getContext('2d') }; }
                reset(cc, w, h) { cc.canvas.width = w; cc.canvas.height = h; }
                destroy(cc) { cc.canvas = null; cc.context = null; }
                createImage() { return new canvas.Image(); }
            })()
        }).promise;

        const buf = c.toBuffer('image/png');
        console.log(`PNG Buffer size: ${buf.length} bytes`);
        fs.writeFileSync('debug_spacer_patched.png', buf);

    } catch (err) {
        console.error(`ERROR:`, err.message);
    }
}

verifyFix();
