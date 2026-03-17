require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { VertexAI } = require('@google-cloud/vertexai');
const sharp = require('sharp');
const logService = require('./logService');

class AIService {
    constructor() {
        this.modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        this.location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
        this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'aizumen';

        this.initialized = false;
        this.initError = null;
        this.mode = null;

        // AIConfig (Common options)
        this.generationConfig = {
            temperature: 0.1,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json'
        };

        this.initialize();
    }

    initialize() {
        const hasCredentialsJson = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
        const hasCredentialsFile = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

        if (hasCredentialsJson || hasCredentialsFile) {
            try {
                let vertexOptions = {
                    project: this.projectId,
                    location: this.location
                };

                if (hasCredentialsJson) {
                    try {
                        const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
                        vertexOptions.googleAuthOptions = { credentials };
                        if (!vertexOptions.project) vertexOptions.project = credentials.project_id;
                        console.log('[AIService] Using JSON credentials from environment variable');
                    } catch (pErr) {
                        console.error('[AIService] Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', pErr.message);
                    }
                }

                this.vertexAI = new VertexAI(vertexOptions);
                this.model = this.vertexAI.getGenerativeModel({
                    model: this.modelName,
                    generationConfig: this.generationConfig
                });
                this.initialized = true;
                this.mode = 'Vertex AI';
                console.log(`[AIService] Initialized with ${this.mode} (Model: ${this.modelName}, Project: ${vertexOptions.project})`);
                return;
            } catch (err) {
                this.initError = err;
                console.error('[AIService] Failed to initialize Vertex AI:', err.message);
            }
        }

        // Gemini API Fallback
        if (process.env.GEMINI_API_KEY) {
            try {
                this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                this.model = this.genAI.getGenerativeModel({
                    model: this.modelName,
                    generationConfig: this.generationConfig
                });
                this.initialized = true;
                this.mode = 'Gemini API';
                console.log(`[AIService] Initialized with ${this.mode} (Model: ${this.modelName})`);
            } catch (err) {
                this.initError = err;
                console.error('[AIService] Failed to initialize Gemini API:', err.message);
            }
        } else {
            console.warn('[AIService] No AI configuration found (Missing Vertex AI credentials or Gemini API key)');
        }
    }

    /**
     * Helper to format inline data based on SDK mode
     */
    _formatInlineData(base64Data, mimeType) {
        if (this.mode === 'Vertex AI') {
            return {
                inline_data: {
                    data: base64Data,
                    mime_type: mimeType
                }
            };
        } else {
            return {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            };
        }
    }

    /**
     * Common method to generate text results
     */
    async generateText(prompt, fileBuffer = null, mimeType = null) {
        if (!this.initialized) throw new Error('AIService is not initialized');

        try {
            let parts = [{ text: prompt }];

            if (fileBuffer && mimeType) {
                parts.push(this._formatInlineData(fileBuffer.toString('base64'), mimeType));
            }

            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts }]
            });
            const response = await result.response;
            const text = response.text();

            logService.debug('AI Text Generated', { textPreview: text.substring(0, 100) });
            return text;
        } catch (error) {
            logService.error({
                message: error.message,
                source: 'server_ai_service_generateText'
            });
            throw error;
        }
    }

    /**
     * Analyze document content (OCR)
     */
    async analyzeDocument(fileBuffers, mimeTypes, tenantSettings = null) {
        if (!this.initialized) throw new Error(`AIService is not initialized. Error: ${this.initError?.message || 'Unknown'}`);

        try {
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

            const learningHints = tenantSettings?.ai_learning_hints || [];
            const learningInstruction = learningHints.length > 0 
                ? `\n### 【重要】以前の修正に基づく補足命令 (学習事項):\n${learningHints.map(h => `- ${h}`).join('\n')}\n`
                : '';

            const promptText = `あなたは製造業の注文書・図面解析のエキスパートです。
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
5. **システム備考 (systemNotes)**: 検算の結果判明した疑義、AIによる補足説明、注意喚起など。
6. **図番 (drawingNumber)**: 図面に記載されている図面番号。
7. **明細 (items)**: 品名、材質、加工方法、表面処理、数量、単価、納期、寸法を抽出してください。

### 出力フォーマット (JSONのみ):
\`\`\`json
{
  "companyName": "...",
  "orderNumber": "...",
  "constructionNumber": "...",
  "notes": "...",
  "systemNotes": "...",
  "pageClassifications": [],
  "items": []
}
\`\`\`
日本語で回答してください。JSON以外の説明テキストは一切含めないでください。`;

            const parts = [{ text: promptText }];

            const images = await Promise.all(buffers.map(async (buffer, i) => {
                const mimeType = types[i] || 'application/pdf';
                let processedBuffer = buffer;

                if (mimeType.startsWith('image/')) {
                    try {
                        const image = sharp(buffer);
                        const metadata = await image.metadata();
                        if (metadata.width > 2000 || metadata.height > 2000) {
                            processedBuffer = await image
                                .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
                                .toBuffer();
                        }
                    } catch (sharpError) {
                        logService.warn(`AI Image Optimization failed`, { error: sharpError.message });
                    }
                }

                return this._formatInlineData(processedBuffer.toString('base64'), mimeType);
            }));

            parts.push(...images);

            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts }]
            });
            const responseText = result.response.text();
            
            return this.parseJsonResponse(responseText);
        } catch (error) {
            logService.error({
                message: error.message,
                status: error.status,
                code: error.code,
                source: 'server_ai_service_analyzeDocument'
            });
            throw error;
        }
    }

    parseJsonResponse(text) {
        try {
            const jsonMatch = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/);
            const jsonString = jsonMatch ? jsonMatch[1] : text;
            return JSON.parse(jsonString);
        } catch (error) {
            console.error('[AIService] Failed to parse JSON:', text);
            return { companyName: "解析エラー", notes: "AIの応答を解析できませんでした。", items: [] };
        }
    }

    getStatus() {
        return {
            initialized: this.initialized,
            mode: this.mode || 'Not Initialized',
            error: this.initError?.message || null,
            config: {
                model: this.modelName,
                location: this.location
            }
        };
    }
}

module.exports = new AIService();
