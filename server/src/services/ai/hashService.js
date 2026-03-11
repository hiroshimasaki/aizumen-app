const sharp = require('sharp');

/**
 * 画像ハッシュ生成サービス (dHash: Difference Hash)
 * 同一または非常に類似した図面を高速に特定するために使用
 */
class HashService {
    /**
     * 画像の dHash (64-bit hex) を生成する
     * @param {Buffer} buffer 
     * @returns {Promise<string>} 16進文字列のハッシュ (16文字)
     */
    async generateDHash(buffer) {
        try {
            // 9x8にリサイズ（行内の隣接ピクセル比較のため幅を+1）
            const { data, info } = await sharp(buffer)
                .grayscale()
                .resize(9, 8, { fit: 'fill' })
                .raw()
                .toBuffer({ resolveWithObject: true });

            let hash = '';
            for (let row = 0; row < 8; row++) {
                let rowHash = 0;
                for (let col = 0; col < 8; col++) {
                    const left = data[row * 9 + col];
                    const right = data[row * 9 + col + 1];
                    // 隣り合うピクセルの大小関係をビットにする
                    if (left < right) {
                        rowHash |= (1 << (7 - col));
                    }
                }
                hash += rowHash.toString(16).padStart(2, '0');
            }
            return hash;
        } catch (error) {
            console.error('[HashService] Failed to generate dHash:', error);
            throw error;
        }
    }

    /**
     * 2つのハッシュのハミング距離を計算する
     * (DB側の計算ロジック検証用)
     */
    calculateHammingDistance(hash1, hash2) {
        if (hash1.length !== hash2.length) return 64;
        let distance = 0;
        for (let i = 0; i < hash1.length; i++) {
            let xor = parseInt(hash1[i], 16) ^ parseInt(hash2[i], 16);
            // 立っているビットを数える
            while (xor > 0) {
                if (xor & 1) distance++;
                xor >>= 1;
            }
        }
        return distance;
    }
}

module.exports = new HashService();
