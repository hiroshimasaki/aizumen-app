require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const sharp = require('sharp');
const logService = require('./logService');

class AIService {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        this.model = this.genAI.getGenerativeModel({ 
            model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
            generationConfig: {
                temperature: 0.1,
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 8192,
                responseMimeType: 'application/json'
            }
        });
    }

    /**
     * Analyze document content using Vertex AI / Gemini
     */
    async analyzeDocument(fileBuffers, mimeTypes, tenantSettings = null) {
        try {
            // 配列でない場合は配列に変換 (Hotfix for single file OCR)
            const buffers = Array.isArray(fileBuffers) ? fileBuffers : [fileBuffers];
            const types = Array.isArray(mimeTypes) ? mimeTypes : [mimeTypes];

            const map = tenantSettings?.ocrMapping || {};
            const tenantExcludeInstruction = tenantSettings?.name 
                ? `（「${tenantSettings.name}」および、その略称や表記揺れ（例：（株）、(株)、株、株式会社 など）を含む自社名は、顧客名として決して抽出しないでください）` 
                : '';

            const mappingData = {
                itemNameLabel: map.itemNameLabel || '品名, 図番, 品番',
                deadlineLabel: map.deadlineLabel || '納期, 希望納期, 納品日',
                dimensionsLabel: map.dimensionsLabel || '寸法, サイズ, 規格, Dimensions',
                orderNumberLabel: map.orderNumberLabel || '注文番号, 発注番号, 注文NO',
                constructionNumberLabel: map.constructionNumberLabel || '工事番号, 工番, K-No',
                processingCostLabel: map.processingCostLabel || '加工費',
                materialCostLabel: map.materialCostLabel || '材料費',
                otherCostLabel: map.otherCostLabel || 'その他費用',
                quantityLabel: map.quantityLabel || '数量',
            };

            // 学習したヒントを抽出
            const learningHints = tenantSettings?.ai_learning_hints || [];
            const learningInstruction = learningHints.length > 0 
                ? `\n### 【重要】以前の修正に基づく補足命令 (学習事項):\n${learningHints.map(h => `- ${h}`).join('\n')}\n`
                : '';

            const prompt = `
あなたは製造業の注文書・図面解析のエキスパートです。
添付されたドキュメントの全ページを詳細に確認し、指定されたフォーマットで回答してください。${learningInstruction}

### 【重要】ページ種別判定 (pageClassifications):
添付されたPDFの全ページに対して、1ページ目から順に以下の種別を判定してください：
- **page**: ページ番号（数値）。
- **type**: 「order_form」（注文書・発注書）、「drawing」（図面）、「other」（その他）のいずれか。
- **label**: 日本語のラベル（「注文書」、「図面」など）。

### 抽出ルール (項目抽出):
1. **会社名 (companyName)**: 発注元（顧客）の会社名。自社名${tenantExcludeInstruction}は除外し、発注者（お客様）の社名のみを抽出してください。
2. **注文番号 (orderNumber)**: 「${mappingData.orderNumberLabel}」に該当する項目。
3. **工事番号 (constructionNumber)**: 「${mappingData.constructionNumberLabel}」に該当する項目。
4. **特記事項 (notes)**: 書類に記載されている注意事項、納期・支払条件など。
5. **システム備考 (systemNotes)**: 検算の結果判明した疑義、AIによる補足説明、注意喚起など（書類に直接記載されていない内容）。
6. **図番 (drawingNumber)**: 図面に記載されている図面番号。「${mappingData.itemNameLabel}」に該当する項目も参考にしてください。
6. **明細 (items)**: 以下の項目をリストで抽出してください：
    - **name**: 品名や品番。「${mappingData.itemNameLabel}」に該当する項目から抽出してください。
    - **material**: 材質（例: SS400, SUS304, AL, 樹脂等）。
    - **processingMethod**: 主要な加工方法（例: 旋盤, フライス, レーザー, ベンダー等）。
    - **surface_treatment**: 表面処理（例: メッキ, 焼入, 塗装, 黒染等）。
    - **quantity**: 数量（数値のみ）。「${mappingData.quantityLabel}」に該当する項目から抽出してください。
    - **unit**: 単位。
    - **processingCost**: 加工費。「${mappingData.processingCostLabel}」に該当する項目から、必ず「1個あたりの単価」を抽出してください。
    - **materialCost**: 材料費。「${mappingData.materialCostLabel}」に該当する項目から、必ず「1個あたりの単価」を抽出してください。
    - **otherCost**: その他費用。「${mappingData.otherCostLabel}」に該当する項目から、必ず「1個あたりの単価」を抽出してください。
    - **dueDate**: 納期。形式は **YYYY-MM-DD**。「${mappingData.deadlineLabel}」に該当する項目から抽出してください。
    - **dimensions**: 寸法（例：100x200, Φ50など）。「${mappingData.dimensionsLabel}」に該当する項目から抽出してください。
    - **requiresVerification**: 検算フラグ（boolean）。後述のルールに基づき設定。

### 検算・判別ルール:
- **単価と小計の区別**: 書類に「単価」と「金額/発注金額（小計）」の両方が記載されている場合、必ず「単価」行の数値を抽出してください。
- **検算**: 「(processingCost + materialCost + otherCost) × quantity = 書類上の明細合計金額」が成り立つか確認してください。
- **フラグ (requiresVerification)**: 以下のいずれかに該当する場合、true に設定してください。
    1. 計算が一致しない場合。
    2. 書類に単価の記載がなく、合計金額（小計）を数量で割って単価を算出した場合。
    3. 「単価」として抽出した数値が、実は「合計金額」である疑いが高い場合。
- 疑義がある場合は、その理由を全体の **systemNotes** 欄に記載してください。特記事項 (notes) には書類から読み取った内容のみを記載してください。

### 出力フォーマット (JSONのみ):
\`\`\`json
{
  "companyName": "...",
  "orderNumber": "...",
  "constructionNumber": "...",
  "notes": "...",
  "systemNotes": "...",
  "pageClassifications": [
    ...
  ],
  "items": [
    {
      "name": "...",
      "material": "...",
      "processingMethod": "...",
      "surface_treatment": "...",
      "quantity": 1,
      "unit": "...",
      "processingCost": 5000,
      "materialCost": 0,
      "otherCost": 0,
      "dueDate": "2024-05-20",
      "dimensions": "100x200",
      "requiresVerification": false
    }
  ]
}
\`\`\`

日本語で回答してください。JSON以外の説明テキストは一切含めないでください。日付は可能な限り現在の年（2026年）を補完して回答してください。
`;

            const images = await Promise.all(buffers.map(async (buffer, i) => {
                const mimeType = types[i] || 'application/pdf';
                let processedBuffer = buffer;

                // 画像ファイルの場合、長辺を2000pxにリサイズしてトークン節約と速度向上を図る
                if (mimeType.startsWith('image/')) {
                    try {
                        const image = sharp(buffer);
                        const metadata = await image.metadata();
                        
                        // 長辺が2000pxを超えている場合のみリサイズ
                        if (metadata.width > 2000 || metadata.height > 2000) {
                            processedBuffer = await image
                                .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
                                .toBuffer();
                            logService.debug(`AI Image Optimized: ${metadata.width}x${metadata.height} -> Resized to 2000px max`);
                        }
                    } catch (sharpError) {
                        logService.warn(`AI Image Optimization failed, sending original`, { error: sharpError.message });
                    }
                }

                return {
                    inlineData: {
                        data: processedBuffer.toString('base64'),
                        mimeType: mimeType
                    }
                };
            }));

            const result = await this.model.generateContent([prompt, ...images]);
            const responseText = result.response.text();
            
            logService.debug('AI: Raw response received', { textPreview: responseText.substring(0, 100) });
            return this.parseJsonResponse(responseText);
        } catch (error) {
            const errorDetails = {
                message: error.message,
                status: error.status,
                code: error.code,
                source: 'server_ai_service_generateContent'
            };
            logService.error(errorDetails);
            console.error('[AIService] Analysis error:', errorDetails);
            throw error;
        }
    }

    /**
     * Parse JSON from AI response (handles markdown code blocks)
     */
    parseJsonResponse(text) {
        try {
            const jsonMatch = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/);
            const jsonString = jsonMatch ? jsonMatch[1] : text;
            return JSON.parse(jsonString);
        } catch (error) {
            console.error('[AIService] Failed to parse JSON:', text);
            return {
                companyName: "解析エラー",
                notes: "AIの応答を解析できませんでした。",
                items: []
            };
        }
    }

    /**
     * Get Service Status (for diagnostics)
     */
    getStatus() {
        return {
            initialized: !!this.model,
            config: {
                model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
                location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
            }
        };
    }
}

module.exports = new AIService();
