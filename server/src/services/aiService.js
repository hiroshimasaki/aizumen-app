const { VertexAI } = require('@google-cloud/vertexai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logService = require('./logService');

/**
 * AI Document Analysis Service
 * Hybrid implementation:
 * 1. Uses Vertex AI (Google Cloud) in Production (secure, no data training).
 * 2. Falls back to Google AI SDK (API Key) in Development.
 */
class AIService {
    constructor() {
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
        const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
        const apiKey = process.env.GEMINI_API_KEY;

        // Mode Detection
        if (projectId && credentialsJson) {
            this.initVertexAI(projectId, credentialsJson);
        } else if (apiKey) {
            this.initGoogleAI(apiKey);
        } else {
            console.error('[AIService] Critical Error: No AI credentials found (Vertex AI or Gemini API Key)');
        }
    }

    /**
     * Initialize Production Mode (Vertex AI)
     * Data is NOT used for training.
     */
    initVertexAI(projectId, credentialsJson) {
        try {
            const credentials = JSON.parse(credentialsJson);
            // Stronger normalization for private_key (handles various env var escaping)
            if (credentials.private_key) {
                let pk = credentials.private_key;
                pk = pk.replace(/\n/g, ' '); 
                pk = pk.replace(/\\n/g, '\n');
                pk = pk.trim();
                if (!pk.includes('\n') && pk.includes('-----BEGIN PRIVATE KEY-----')) {
                    pk = pk.replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
                           .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
                }
                credentials.private_key = pk;
            }
            this.vertexAI = new VertexAI({
                project: projectId,
                location: 'us-central1',
                googleAuthOptions: { credentials }
            });
            this.model = this.vertexAI.getGenerativeModel({ model: 'gemini-1.5-flash-002' });
            this.mode = 'PRODUCTION (Vertex AI)';
            this.isInitialized = true;
            console.log(`[AIService] Success: Initialized in ${this.mode} mode. Project: ${projectId}`);
        } catch (error) {
            this.isInitialized = false;
            this.initError = error.message;
            console.error('[AIService] Production initialization failed:', error);
        }
    }

    /**
     * Initialize Development Mode (Google AI SDK)
     */
    initGoogleAI(apiKey) {
        try {
            this.genAI = new GoogleGenerativeAI(apiKey);
            // 現在のAPIキーで利用可能な 2.5系 を使用
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
            this.mode = 'DEVELOPMENT (Google AI SDK)';
            console.log(`[AIService] Success: Initialized in ${this.mode} mode.`);
        } catch (error) {
            console.error('[AIService] Development initialization failed:', error);
        }
    }

    /**
     * Generate content (Unified method for both SDKs)
     * @param {string} prompt 
     * @param {Buffer} fileBuffer 
     * @param {string} mimeType 
     * @param {Array} additionalImages Array of { buffer, mimeType }
     * @returns {Promise<string>} Generated text content
     */
    async generateText(prompt, fileBuffer, mimeType, additionalImages = []) {
        if (!this.model) throw new Error('AI Service not initialized');
        const timestamp = new Date().toISOString();

        console.log(`[AIService][${timestamp}] --- NEW REQUEST ---`);
        console.log(`[AIService][${timestamp}] Mode: ${this.mode}`);
        console.log(`[AIService][${timestamp}] Model Name: ${this.model.model}`);

        try {
            // SDK response extraction
            if (this.mode.includes('Vertex')) {
                const parts = [{ text: prompt }];
                
                if (fileBuffer && mimeType) {
                    parts.push({
                        inlineData: {
                            data: fileBuffer.toString('base64'),
                            mimeType: mimeType
                        }
                    });
                }

                for (const [idx, img] of additionalImages.entries()) {
                    logService.debug(`[AIService] (Vertex AI) Adding additional image ${idx}: ${img.buffer?.length} bytes, type ${img.mimeType}`);
                    parts.push({
                        inlineData: {
                            data: img.buffer.toString('base64'),
                            mimeType: img.mimeType
                        }
                    });
                }

                const request = {
                    contents: [{ role: 'user', parts }]
                };

                logService.debug(`[AIService] Sending request to Vertex AI...`);
                const response = await this.model.generateContent(request);
                const text = response.response.candidates[0].content.parts[0].text;
                return text;
            } else {
                // Google AI SDK (Development) format
                const parts = [prompt];

                if (fileBuffer && mimeType) {
                    parts.push({
                        inlineData: {
                            data: fileBuffer.toString('base64'),
                            mimeType: mimeType
                        }
                    });
                }

                for (const [idx, img] of additionalImages.entries()) {
                    logService.debug(`[AIService] (Google AI) Adding additional image ${idx}: ${img.buffer?.length} bytes, type ${img.mimeType}`);
                    parts.push({
                        inlineData: {
                            data: img.buffer.toString('base64'),
                            mimeType: img.mimeType
                        }
                    });
                }

                const response = await this.model.generateContent(parts);
                const text = response.response.text();
                return text;
            }
        } catch (error) {
            logService.debug(`[AIService] CRITICAL ERROR in generateText: ${error.message}`);
            if (error.stack) logService.debug(`[AIService] Error Stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Analyze a document (PDF or Image)
     */
    async analyzeDocument(fileBuffer, mimeType, mappingData = {}, tenantName = '') {
        try {
            const map = {
                processingCost: mappingData.processingCostLabel || '加工費, 工賃, 作業代',
                materialCost: mappingData.materialCostLabel || '材料費, 部品代, 資材費',
                otherCost: mappingData.otherCostLabel || 'その他費用, 諸経費, 運賃',
                itemName: mappingData.itemNameLabel || '品名, 図番, ProductName',
                quantity: mappingData.quantityLabel || '数量, 個数, Qty',
                deadline: mappingData.deadlineLabel || '納期, 希望納期, 納品日',
                orderNumber: mappingData.orderNumberLabel || '注文番号, 発注番号, 注文NO',
                constructionNumber: mappingData.constructionNumberLabel || '工事番号, 図番, 工事NO'
            };

            const tenantExcludeInstruction = tenantName ? `ただし、自社名（${tenantName}）は抽出対象から除外し、必ず「発注元の会社名」のみを抽出してください。` : '';

            const prompt = `
あなたは製造業の注文書・図面解析のエキスパートです。
添付されたドキュメント（注文書、発注書、または図面）から必要な情報を抽出し、指定されたJSONフォーマットで回答してください。

### 抽出ルール (以下の項目名・類義語を重点的に探してください):
1. **会社名 (companyName)**: 発注元（顧客）の会社名を正確に抽出してください。${tenantExcludeInstruction}
2. **注文番号 (orderNumber)**: 「${map.orderNumber}」に該当する項目。なければ空文字。
3. **工事番号 (constructionNumber)**: 「${map.constructionNumber}」に該当する項目。なければ空文字。
4. **特記事項 (notes)**: 解析時の注意点や、納期・支払条件などの重要な備考があれば抽出してください。
5. **明細 (items)**: 注文内容の明細をリストで抽出してください。以下の項目マッピングを参考にしてください：
    - **name**: 「${map.itemName}」に該当する項目（品名や品番）。
    - **quantity**: 「${map.quantity}」に該当する項目（数値のみ）。
    - **unit**: 単位（個、枚、kg等）。
    - **price**: 「${map.processingCost}」に該当する項目（数値のみ、不明な場合は null）。
    - **dueDate**: 「${map.deadline}」に該当する日付。形式は必ず **YYYY-MM-DD** としてください。もし特定の日付がない場合は null としてください。

### 出力フォーマット (JSONのみ):
\`\`\`json
{
  "companyName": "...",
  "orderNumber": "...",
  "constructionNumber": "...",
  "notes": "...",
  "items": [
    {
      "name": "...",
      "quantity": 1,
      "unit": "...",
      "price": 5000,
      "dueDate": "2024-05-20"
    }
  ]
}
\`\`\`

日本語で回答してください。JSON以外の説明テキストは一切含めないでください。日付は可能な限り現在の年（2026年）を補完して回答してください。
`;

            const responseText = await this.generateText(prompt, fileBuffer, mimeType);
            return this.parseJsonResponse(responseText);
        } catch (error) {
            console.error('[AIService] Analysis failed:', error);
            throw error;
        }
    }

    /**
     * Parse JSON from AI response (handles markdown code blocks)
     */
    parseJsonResponse(text) {
        try {
            const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
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
            initialized: !!this.model && this.isInitialized !== false,
            mode: this.mode || 'UNINITIALIZED',
            model: this.model?.model || null,
            hasVertexAI: !!this.vertexAI,
            hasGoogleAI: !!this.genAI,
            initError: this.initError || null,
            config: {
                hasProjectId: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
                hasCredentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
                hasApiKey: !!process.env.GEMINI_API_KEY
            }
        };
    }
}

module.exports = new AIService();
