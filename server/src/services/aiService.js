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
                project: credentials.project_id || projectId,
                location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
                googleAuthOptions: { credentials }
            });
            // モデル名は gemini-1.5-flash (stable) をデフォルトにする
            const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
            this.model = this.vertexAI.getGenerativeModel({ model: modelName });
            this.mode = 'PRODUCTION (Vertex AI)';
            this.isInitialized = true;
            
            const finalProjectId = credentials.project_id || projectId;
            const maskedProject = finalProjectId ? `${finalProjectId.substring(0, 3)}***${finalProjectId.substring(finalProjectId.length - 2)}` : '???';
            console.log(`[AIService] Success: Initialized in ${this.mode} mode. Project: ${maskedProject}, Model: ${modelName}`);
            
            if (credentials.project_id && projectId && credentials.project_id !== projectId) {
                console.warn(`[AIService] Warning: Project ID mismatch! Env=${projectId}, JSON=${credentials.project_id}. Using JSON ID.`);
            }
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
        const MAX_RETRIES = 3;
        let retryCount = 0;

        const executeRequest = async () => {
            const timestamp = new Date().toISOString();
            logService.debug(`[AIService][${timestamp}] Request to ${this.mode} (Retry: ${retryCount})`);

            try {
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

                    for (const img of additionalImages) {
                        parts.push({
                            inlineData: {
                                data: img.buffer.toString('base64'),
                                mimeType: img.mimeType
                            }
                        });
                    }

                    const response = await this.model.generateContent({
                        contents: [{ role: 'user', parts }]
                    });
                    
                    if (!response || !response.response) throw new Error('AI response is empty');
                    const candidates = response.response.candidates;
                    if (!candidates || candidates.length === 0) {
                        throw new Error('AI returned no response candidates (possibly blocked by safety filters)');
                    }
                    const text = candidates[0].content?.parts?.[0]?.text;
                    if (!text) throw new Error('AI response candidate has no text parts');
                    return text;
                } else {
                    const parts = [prompt];
                    if (fileBuffer && mimeType) {
                        parts.push({ inlineData: { data: fileBuffer.toString('base64'), mimeType } });
                    }
                    for (const img of additionalImages) {
                        parts.push({ inlineData: { data: img.buffer.toString('base64'), mimeType: img.mimeType } });
                    }
                    const response = await this.model.generateContent(parts);
                    return response.response.text();
                }
            } catch (error) {
                // 429 (Rate Limit / Resource Exhausted) の判定
                const isRateLimit = error.message?.includes('429') || 
                                   error.message?.includes('RESOURCE_EXHAUSTED') ||
                                   error.status === 429;

                if (isRateLimit && retryCount < MAX_RETRIES) {
                    retryCount++;
                    const waitTime = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
                    console.warn(`[AIService] Rate limit hit. Retrying in ${waitTime}ms... (Attempt ${retryCount}/${MAX_RETRIES})`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    return executeRequest();
                }

                logService.error(`[AIService] Error after ${retryCount} retries: ${error.message}`);
                throw error;
            }
        };

        return executeRequest();
    }

    /**
     * Analyze a document (PDF or Image)
     */
    async analyzeDocument(fileBuffer, mimeType, mappingData = {}, tenantName = '') {
        const analyzeStart = Date.now();
        console.log(`[AIService] Starting analysis...`);
        try {
            const map = {
                processingCost: mappingData.processingCostLabel || '加工費, 工賃, 作業代',
                materialCost: mappingData.materialCostLabel || '材料費, 部品代, 資材費',
                otherCost: mappingData.otherCostLabel || 'その他費用, 諸経費, 運賃',
                itemName: mappingData.itemNameLabel || '品名, 図番, ProductName',
                quantity: mappingData.quantityLabel || '数量, 個数, Qty',
                deadline: mappingData.deadlineLabel || '納期, 希望納期, 納品日',
                dimensions: mappingData.dimensionsLabel || '寸法, サイズ, 規格, Dimensions',
                orderNumber: mappingData.orderNumberLabel || '注文番号, 発注番号, 注文NO',
                constructionNumber: mappingData.constructionNumberLabel || '工事番号, 図番, 工事NO'
            };

            const tenantExcludeInstruction = tenantName ? `ただし、自社名（${tenantName}）は抽出対象から除外し、必ず「発注元の会社名」のみを抽出してください。` : '';

            const prompt = `
あなたは製造業の注文書・図面解析のエキスパートです。
添付されたドキュメントの全ページを詳細に確認し、指定されたフォーマットで回答してください。

### 【重要】ページ種別判定 (pageClassifications):
添付されたPDFの全ページに対して、1ページ目から順に以下の種別を判定してください：
- **page**: ページ番号（数値）。
- **type**: 「order_form」（注文書・発注書）、「drawing」（図面）、「other」（その他）のいずれか。
- **label**: 日本語のラベル（「注文書」、「図面」など）。

### 抽出ルール (項目抽出):
1. **会社名 (companyName)**: 発注元（顧客）の会社名。${tenantExcludeInstruction}
2. **注文番号 (orderNumber)**: 「${map.orderNumber}」に該当する項目。
3. **工事番号 (constructionNumber)**: 「${map.constructionNumber}」に該当する項目。
4. **特記事項 (notes)**: 注意事項、納期・支払条件など。
5. **明細 (items)**: 以下の項目をリストで抽出してください：
    - **name**: 品名や品番。
    - **quantity**: 数量（数値のみ）。
    - **unit**: 単位。
    - **processingCost**: 加工費。
    - **materialCost**: 材料費。
    - **otherCost**: その他費用。
    - **dueDate**: 納期。形式は **YYYY-MM-DD**。
    - **dimensions**: 寸法（例：100x200, Φ50など）。「${map.dimensions}」に該当する項目から抽出してください。

### 出力フォーマット (JSONのみ):
\`\`\`json
{
  "companyName": "...",
  "orderNumber": "...",
  "constructionNumber": "...",
  "notes": "...",
  "pageClassifications": [
    { "page": 1, "type": "order_form", "label": "注文書" },
    { "page": 2, "type": "drawing", "label": "図面" }
  ],
  "items": [
    {
      "name": "...",
      "quantity": 1,
      "unit": "...",
      "processingCost": 5000,
      "materialCost": 0,
      "otherCost": 0,
      "dueDate": "2024-05-20",
      "dimensions": "100x200"
    }
  ]
}
\`\`\`

日本語で回答してください。JSON以外の説明テキストは一切含めないでください。日付は可能な限り現在の年（2026年）を補完して回答してください。
`;

            const responseText = await this.generateText(prompt, fileBuffer, mimeType);
            const duration = Date.now() - analyzeStart;
            console.log(`[AIService] Analysis complete in ${duration}ms. Raw Response:`, responseText);
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
                hasApiKey: !!process.env.GEMINI_API_KEY,
                envProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID ? `${process.env.GOOGLE_CLOUD_PROJECT_ID.substring(0, 3)}...${process.env.GOOGLE_CLOUD_PROJECT_ID.substring(process.env.GOOGLE_CLOUD_PROJECT_ID.length - 2)}` : null,
                jsonProjectId: this._getJsonProjectId(),
                location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
            }
        };
    }

    _getJsonProjectId() {
        try {
            const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
            if (!json) return null;
            const creds = JSON.parse(json);
            const id = creds.project_id;
            return id ? `${id.substring(0, 3)}...${id.substring(id.length - 2)}` : 'not-found-in-json';
        } catch (e) {
            return 'invalid-json';
        }
    }

    /**
     * Test AI connectivity with a simple prompt
     */
    async testAI() {
        if (!this.model) return { status: 'error', message: 'Model not initialized' };
        try {
            const start = Date.now();
            const text = await this.generateText('Hello, respond with "OK" only.', null, null);
            const duration = Date.now() - start;
            return {
                status: 'ok',
                response: text.trim(),
                durationMs: duration
            };
        } catch (error) {
            let message = error.message;
            // 404 (NOT_FOUND) は API が無効化されているか、プロジェクトID/リージョンが間違っている場合に発生
            if (message.includes('404') || message.includes('NOT_FOUND')) {
                const configLocation = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
                message = `[VertexAI.APIError] 404 Not Found. 設定されたリージョン '${configLocation}' にモデルが存在しないか、API がそのリージョンで有効になっていません。GCP コンソールの Vertex AI 画面等で、正しいリージョンであることを確認してください。東京リージョンの場合は 'asia-northeast1' を環境変数 GOOGLE_CLOUD_LOCATION に設定してください。(Original: ${error.message})`;
            }
            return {
                status: 'error',
                message: message
            };
        }
    }
}

module.exports = new AIService();
