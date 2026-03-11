const sharp = require('sharp');
let canvas;
try {
    // pdfjs-dist v5 と同じ @napi-rs/canvas を使用
    canvas = require('@napi-rs/canvas');
} catch {
    canvas = require('canvas');
}
const logService = require('../logService');

/**
 * Node.js環境用のCanvasファクトリ
 */
class NodeCanvasFactory {
    create(width, height) {
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
 * node-canvas の drawImage パッチ
 */
function applyNodeCanvasPatch(context) {
    const originalDrawImage = context.drawImage;
    context.drawImage = function(img, ...args) {
        if (!img) return;
        
        try {
            const isNative = (img instanceof canvas.Image) || (img instanceof canvas.Canvas);
            
            if (!isNative && typeof img === 'object') {
                let actualData = null;
                if (typeof img.data === 'function') {
                    actualData = img.data();
                } else if (img.data) {
                    actualData = img.data;
                }

                if (img.width && img.height && actualData) {
                    const tempC = canvas.createCanvas(img.width, img.height);
                    const tempCtx = tempC.getContext('2d');
                    const uint8data = (actualData instanceof Uint8ClampedArray) ? actualData : new Uint8ClampedArray(actualData);
                    
                    if (uint8data.length > 0) {
                        const imgData = canvas.createImageData(uint8data, img.width, img.height);
                        tempCtx.putImageData(imgData, 0, 0);
                        return originalDrawImage.call(this, tempC, ...args);
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
            // ignore patch error
        }
        
        // [MOD] ベクター線の消失を防ぐため、最小線幅と色の濃さを保証するパッチ
        const origStroke = context.stroke;
        const origFill = context.fill;
        const origStrokeRect = context.strokeRect;

        context.stroke = function() {
            // 細すぎる線をさらに太く (2.0 -> 3.0)
            if (this.lineWidth < 3.0) this.lineWidth = 3.0;
            // 極端に薄い色の線を黒寄りに補正
            if (this.strokeStyle === '#ffffff' || this.strokeStyle === 'white') {
                // 背景と同じ色の場合は無視（または反転を検討）
            } else {
                // 不透明度を上げるなどの処理
                this.globalAlpha = 1.0;
            }
            return origStroke.apply(this);
        };
        context.strokeRect = function(...args) {
            if (this.lineWidth < 2.0) this.lineWidth = 2.0;
            return origStrokeRect.apply(this, args);
        };

        try {
            return originalDrawImage.apply(this, [img, ...args]);
        } catch (e) {
            return;
        }
    };
}

/**
 * 画像の前処理（ノイズ除去・二値化・PDF変換）
 */
async function preprocessImage(buffer, mimeType = 'image/png') {
    let imageBuffer = buffer;

    if (mimeType === 'application/pdf' || mimeType?.includes('pdf')) {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const { getDocument } = pdfjs;
        
        const path = require('path');
        const fs = require('fs');
        const cMapDir = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'cmaps');

        // [FIX] Windows環境で日本語パスを含むCMapの読み込み失敗を回避するカスタムFactory
        // pdfjs-distの BaseCMapReaderFactory と同じインターフェースを実装
        class CustomCMapReaderFactory {
            constructor({ baseUrl = null, isCompressed = true } = {}) {
                this.baseUrl = baseUrl;
                this.isCompressed = isCompressed;
            }
            async fetch({ name }) {
                if (!name) throw new Error('CMap name must be specified.');
                const fileName = name + (this.isCompressed ? '.bcmap' : '');
                const filePath = path.join(cMapDir, fileName);
                try {
                    const data = await fs.promises.readFile(filePath);
                    return { cMapData: new Uint8Array(data), isCompressed: this.isCompressed };
                } catch (e) {
                    throw new Error(`Unable to load ${this.isCompressed ? 'binary ' : ''}CMap at: ${filePath}`);
                }
            }
        }

        // [FIX] pdfjs-dist v5 では CanvasFactory を getDocument() に渡す必要がある
        class CustomCanvasFactory {
            constructor() {}
            create(width, height) {
                const c2 = canvas.createCanvas(width, height);
                const ctx2 = c2.getContext('2d');
                applyNodeCanvasPatch(ctx2);
                return { canvas: c2, context: ctx2 };
            }
            reset(canvasAndContext, width, height) {
                canvasAndContext.canvas.width = width;
                canvasAndContext.canvas.height = height;
                applyNodeCanvasPatch(canvasAndContext.context);
            }
            destroy(canvasAndContext) {
                canvasAndContext.canvas = null;
                canvasAndContext.context = null;
            }
        }

        const uint8Array = new Uint8Array(buffer);
        const loadingTask = getDocument({ 
            data: uint8Array,
            CMapReaderFactory: CustomCMapReaderFactory,
            cMapPacked: true,
            disableFontFace: true
        });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        // 高解像度でのサンプリング (OCRほど高くなくて良いので2.0に調整)
        const baseViewport = page.getViewport({ scale: 1.0, rotation: page.rotate });
        const scale = 2.0;
        const c = canvas.createCanvas(baseViewport.width * scale, baseViewport.height * scale);
        const ctx = c.getContext('2d');

        // 背景を白で初期化
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, c.width, c.height);

        // 手動でスケール適用
        ctx.scale(scale, scale);

        applyNodeCanvasPatch(ctx);

        await page.render({ 
            canvasContext: ctx, 
            viewport: baseViewport
        }).promise;

        imageBuffer = c.toBuffer('image/png');
    }

    // thresholdを微調整 (二値化せずにコントラスト強調)
    return sharp(imageBuffer)
        .grayscale()
        .threshold(230) // 少し緩めて (240 -> 230) 細い線の消失を防ぐ
        .toBuffer();
}

/**
 * 画像をタイル状に分割する
 */
async function tileImage(imageBuffer, options = { tileSize: 600, stride: 300 }) {
    const { tileSize, stride } = options;
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;

    const tiles = [];
    let tileIndex = 0;

    for (let y = 0; y <= height - tileSize; y += stride) {
        for (let x = 0; x <= width - tileSize; x += stride) {
            const extractArea = { left: x, top: y, width: tileSize, height: tileSize };
            const tileBuffer = await sharp(imageBuffer).extract(extractArea).toBuffer();

            const stats = await sharp(tileBuffer).stats();
            // [MOD] 白紙判定の閾値を極限まで上げる (254.5 -> 254.9)
            // わずかな線（ベクター）が含まれている場合はスキップしない
            if (stats.channels[0].mean > 254.9) continue; 

            const resizedBuffer = await sharp(tileBuffer).resize(224, 224).toBuffer();

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
 * 特定の範囲を切り出す
 */
async function getTileImage(buffer, mimeType, coords) {
    try {
        let imageBuffer = buffer;
        if (mimeType === 'application/pdf' || mimeType?.includes('pdf')) {
            imageBuffer = await preprocessImage(buffer, mimeType);
        }

        const metadata = await sharp(imageBuffer).metadata();
        const left = Math.max(0, Math.round(coords.x));
        const top = Math.max(0, Math.round(coords.y));
        const width = Math.min(Math.round(coords.width), metadata.width - left);
        const height = Math.min(Math.round(coords.height), metadata.height - top);

        if (width <= 0 || height <= 0) {
            throw new Error(`Invalid dimensions: ${width}x${height}`);
        }

        return await sharp(imageBuffer)
            .extract({ left, top, width, height })
            .png()
            .toBuffer();
    } catch (err) {
        logService.debug(`[ImageService] getTileImage Error: ${err.message}`);
        throw err;
    }
}

module.exports = {
    preprocessImage,
    tileImage,
    getTileImage
};
