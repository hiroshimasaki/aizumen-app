const sharp = require('sharp');

/**
 * 画像の前処理（ノイズ除去・二値化）
 * @param {Buffer} imageBuffer 元画像のバッファ
 * @returns {Promise<Buffer>} 処理後の画像バッファ
 */
async function preprocessImage(imageBuffer) {
    return sharp(imageBuffer)
        .grayscale() // グレースケール化
        .threshold(180) // 二値化（FAXノイズ等の薄いグレーを飛ばす）
        .median(3) // メディアンフィルタで点描状のノイズを低減
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
            const tileBuffer = await sharp(imageBuffer)
                .extract({ left: x, top: y, width: tileSize, height: tileSize })
                .resize(224, 224) // MobileNetV3の入力サイズに合わせる
                .toBuffer();

            tiles.push({
                index: tileIndex++,
                x,
                y,
                width: tileSize,
                height: tileSize,
                buffer: tileBuffer
            });
        }
    }

    return tiles;
}

module.exports = {
    preprocessImage,
    tileImage
};
