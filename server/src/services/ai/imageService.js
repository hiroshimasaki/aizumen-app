const sharp = require('sharp');
const canvas = require('canvas');
const logService = require('../logService');

// PDF.js が Node.js 環境で Image/Canvas を正しく扱えるようにグローバルに設定
if (typeof global !== 'undefined') {
    global.Image = canvas.Image;
    global.Canvas = canvas.Canvas;
    global.ImageData = canvas.ImageData;
    // PDF.js 内部での型チェック対策
    global.HTMLElement = class {};
    global.HTMLCanvasElement = canvas.Canvas;
    // DOMMatrix が必要になる場合があるため、canvasのものを利用するか簡易的なものを設定
    if (typeof global.DOMMatrix === 'undefined') {
        const { DOMMatrix } = require('canvas');
        global.DOMMatrix = DOMMatrix;
    }
}

/**
 * 画像の前処理（ノイズ除去・二値化）
 * @param {Buffer} imageBuffer 元画像のバッファ
 * @returns {Promise<Buffer>} 処理後の画像バッファ
 */
/**
 * Node.js環境用のCanvasファクトリ
 */
class NodeCanvasFactory {
    create(width, height) {
        const canvas = require('canvas');
        const c = canvas.createCanvas(width, height);
        const ctx = c.getContext('2d');
        return {
            canvas: c,
            context: ctx,
        };
    }
    reset(canvasAndContext, width, height) {
        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
    }
    destroy(canvasAndContext) {
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
        canvasAndContext.canvas = null;
        canvasAndContext.context = null;
    }
    createImage() {
        return new canvas.Image();
    }
}

/**
 * node-canvas の drawImage が受け入れないオブジェクト（PDF.jsの特殊なCanvasElementなど）
 * が渡された場合に、強制的に互換性のあるオブジェクトに変換するパッチを適用する
 */
function applyNodeCanvasPatch(context) {
    const originalDrawImage = context.drawImage;
    context.drawImage = function(img, ...args) {
        try {
            // node-canvas が解釈できないオブジェクトの場合
            if (img && typeof img === 'object' && !((img instanceof canvas.Image) || (img instanceof canvas.Canvas))) {
                const dataProp = img.data;
                const actualData = (typeof dataProp === 'function') ? dataProp.call(img) : dataProp;
                
                if (img.width && img.height && actualData && actualData !== 'Error calling data()') {
                    const tempC = canvas.createCanvas(img.width, img.height);
                    const tempCtx = tempC.getContext('2d');
                    try {
                        const uint8data = (actualData instanceof Uint8ClampedArray) ? actualData : new Uint8ClampedArray(actualData);
                        if (uint8data.length > 0) {
                            const imgData = canvas.createImageData(uint8data, img.width, img.height);
                            tempCtx.putImageData(imgData, 0, 0);
                            return originalDrawImage.call(this, tempC, ...args);
                        }
                    } catch (innerE) {
                        // 変換失敗時はフォールバックへ
                    }
                }
                
                if (typeof img.toBuffer === 'function') {
                    const buf = img.toBuffer();
                    const tempImg = new canvas.Image();
                    tempImg.src = buf;
                    return originalDrawImage.call(this, tempImg, ...args);
                }
            }
        } catch (e) {
            // パッチ自体が失敗した場合はログを出すが、実行は継続を試みる
            console.warn('[ImageService] drawImage patch execution failed:', e.message);
        }
        return originalDrawImage.call(this, img, ...args);
    };
}

/**
 * 画像の前処理（ノイズ除去・二値化・PDF変換）
 * @param {Buffer} buffer 元データのバッファ
 * @param {string} mimeType MIMEタイプ
 * @returns {Promise<Buffer>} 処理後の画像バッファ（PNG）
 */
async function preprocessImage(buffer, mimeType = 'image/png') {
    let imageBuffer = buffer;

    if (mimeType === 'application/pdf' || mimeType?.includes('pdf')) {
        const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const { createCanvas } = require('canvas');

        const loadingTask = getDocument({ 
            data: new Uint8Array(buffer),
            nativeImageDecoderSupport: 'none' // Node.js環境での画像デコードエラー対策
        });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        const viewport = page.getViewport({ scale: 2.0 }); // インデックス時も 2.0 倍で統一
        const c = canvas.createCanvas(viewport.width, viewport.height);
        const ctx = c.getContext('2d');

        applyNodeCanvasPatch(ctx);

        await page.render({ 
            canvasContext: ctx, 
            viewport,
            canvasFactory: new NodeCanvasFactory()
        }).promise;
        imageBuffer = c.toBuffer('image/png');
    }

    return sharp(imageBuffer)
        .grayscale()
        .threshold(180)
        .median(3)
        .toBuffer();
}

/**
 * 画像をタイル状に分割する
 * @param {Buffer} imageBuffer 処理済みの画像バッファ
 * @param {Object} options タイル分割オプション
 * @returns {Promise<Array>} タイルデータの配列
 */
async function tileImage(imageBuffer, options = { tileSize: 300, stride: 150 }) {
    const { tileSize, stride } = options;
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;

    const tiles = [];
    let tileIndex = 0;

    for (let y = 0; y <= height - tileSize; y += stride) {
        for (let x = 0; x <= width - tileSize; x += stride) {
            const extractArea = { left: x, top: y, width: tileSize, height: tileSize };
            
            // タイルのバッファを取得
            const tileBuffer = await sharp(imageBuffer)
                .extract(extractArea)
                .toBuffer();

            // [Smart Filtering] 白紙チェック: 
            // 閾値以上の明るさ（ほぼ白）しかない場合はスキップ
            const stats = await sharp(tileBuffer).stats();
            const mean = stats.channels[0].mean;
            
            if (mean > 254) {
                // 白紙に近いタイルはインデックス対象から外す
                continue;
            }

            // AIモデルの入力サイズにリサイズ
            const resizedBuffer = await sharp(tileBuffer)
                .resize(224, 224) 
                .toBuffer();

            tiles.push({
                index: tileIndex++,
                x,
                y,
                width: tileSize,
                height: tileSize,
                buffer: resizedBuffer
            });
        }
    }

    return tiles;
}

/**
 * 特定の範囲を切り出す（PDF/画像両対応）
 * @param {Buffer} buffer 
 * @param {string} mimeType 
 * @param {Object} coords { x, y, width, height }
 * @returns {Promise<Buffer>} 切り出されたPNG画像
 */
async function getTileImage(buffer, mimeType, coords) {
    try {
        let imageBuffer = buffer;
        if (mimeType === 'application/pdf' || mimeType?.includes('pdf')) {
            logService.debug(`[ImageService] Starting PDF render for tile...`);
            // PDF を画像に変換 (1ページ目)
            const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');

            const loadingTask = getDocument({ 
                data: new Uint8Array(buffer),
                nativeImageDecoderSupport: 'none'
            });
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            
            const viewport = page.getViewport({ scale: 2.0 }); 
            const c = canvas.createCanvas(viewport.width, viewport.height);
            const ctx = c.getContext('2d');

            applyNodeCanvasPatch(ctx);

            await page.render({ 
                canvasContext: ctx, 
                viewport,
                canvasFactory: new NodeCanvasFactory()
            }).promise;
            imageBuffer = c.toBuffer('image/png');
            logService.debug(`[ImageService] PDF rendered to buffer: ${imageBuffer.length} bytes`);
        }

        const metadata = await sharp(imageBuffer).metadata();
        logService.debug(`[ImageService] Extracting tile from image of size ${metadata.width}x${metadata.height}:`, coords);
        
        // 切り出し範囲の計算と境界チェック
        const left = Math.max(0, Math.round(coords.x));
        const top = Math.max(0, Math.round(coords.y));
        const width = Math.min(Math.round(coords.width), metadata.width - left);
        const height = Math.min(Math.round(coords.height), metadata.height - top);

        if (width <= 0 || height <= 0) {
            throw new Error(`Invalid extract dimensions: width=${width}, height=${height} at left=${left}, top=${top} for image ${metadata.width}x${metadata.height}`);
        }

        const result = await sharp(imageBuffer)
            .extract({ left, top, width, height })
            .png()
            .toBuffer();
        
        logService.debug(`[ImageService] Tile extraction success: ${result.length} bytes`);
        return result;
    } catch (err) {
        logService.debug(`[ImageService] getTileImage Error: ${err.message}`, { stack: err.stack });
        throw err;
    }
}

module.exports = {
    preprocessImage,
    tileImage,
    getTileImage
};
