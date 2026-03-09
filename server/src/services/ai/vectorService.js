const tf = require('@tensorflow/tfjs');
const mobilenet = require('@tensorflow-models/mobilenet');

let model = null;

/**
 * モデルのロード（シングルトン）
 */
async function loadModel() {
    if (!model) {
        // MobileNetV2をロード（MobileNetV3はtfjs-modelsではまだ実験的な場合があるためV2を選択）
        model = await mobilenet.load({
            version: 2,
            alpha: 1.0
        });
        console.log('AI Model (MobileNetV2) loaded for Embedding generation.');
    }
    return model;
}

/**
 * 画像バッファから特徴量ベクトルを生成
 * @param {Buffer} imageBuffer 画像バッファ
 * @returns {Promise<Array>} 1024次元のベクトル
 */
async function getEmbedding(imageBuffer) {
    const loadedModel = await loadModel();

    // sharpなどのバッファをtf.Tensorに変換する必要がある
    // node-canvasがない場合は、tf.node.decodeImage を使用可能（tfjs-nodeが必要）
    // 今回は tfjs (pure JS) のため、必要に応じて処理を調整

    let tensor;
    try {
        const sharp = require('sharp');
        const rawPixels = await sharp(imageBuffer)
            .resize(224, 224)
            .removeAlpha()
            .raw()
            .toBuffer();

        tensor = tf.tensor3d(new Uint8Array(rawPixels), [224, 224, 3]);
    } catch (e) {
        console.error('Tensor creation failed:', e);
        throw e;
    }

    // 推論（中間層の出力を取得してベクトル化）
    const embeddingTensor = loadedModel.infer(tensor, true); // true = 最後のSoftmaxを飛ばして埋め込みを取得
    const embedding = await embeddingTensor.array();

    // メモリ管理
    tensor.dispose();
    embeddingTensor.dispose();

    return embedding[0]; // [1, 1024] -> [1024]
}

module.exports = {
    getEmbedding
};
