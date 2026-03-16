const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { checkTrialLimit } = require('../middleware/trialMiddleware');
const { checkCredits } = require('../middleware/credits');
const { supabaseAdmin } = require('../config/supabase');
const { AppError } = require('../middleware/errorHandler');
const { checkStorageLimit } = require('../middleware/storageLimit');
const logService = require('../services/logService');

// TODO: Phase 2で本実装（Gemini API連携）
// 現在はスケルトンのみ

const multer = require('multer');
const aiService = require('../services/aiService');
const creditService = require('../services/creditService');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/**
 * POST /api/ocr/analyze
 * OCR解析（1クレジット消費）
 * 実際のファイルを FormData で受け取り、Gemini APIで解析して構造化データを返します。
 */
router.post('/analyze', authMiddleware, checkTrialLimit, checkCredits(1), upload.single('file'), checkStorageLimit, async (req, res, next) => {
    try {
        if (!req.file) {
            throw new AppError('No file provided for analysis', 400, 'NO_FILE');
        }

        // 文字化け対策
        const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

        const amount = 1;

        // テナント名とマッピング設定の取得
        const [{ data: settings }, { data: tenant }] = await Promise.all([
            supabaseAdmin
                .from('tenant_settings')
                .select('settings_json')
                .eq('tenant_id', req.tenantId)
                .single(),
            supabaseAdmin
                .from('tenants')
                .select('name')
                .eq('id', req.tenantId)
                .single()
        ]);

        const ocrMapping = settings?.settings_json?.ocrMapping || {};
        const ai_learning_hints = settings?.settings_json?.ai_learning_hints || [];
        const tenantName = tenant?.name || '';

        // Gemini APIによる解析
        logService.debug('OCR: Starting analysis', { 
            fileName: originalName, 
            mimeType: req.file.mimetype,
            mapping: ocrMapping,
            learningHints: ai_learning_hints
        });
        const analysisResult = await aiService.analyzeDocument(req.file.buffer, req.file.mimetype, { ocrMapping, ai_learning_hints, name: tenantName });

        // クレジット消費処理
        const creditResult = await creditService.consumeCredits(
            req.tenantId,
            req.user.id,
            amount,
            `個別OCR解析: ${originalName}`
        );

        await logService.audit({
            action: 'ocr_analyzed',
            entityType: 'ocr',
            description: `個別OCR解析完了: ${originalName}`,
            tenantId: req.tenantId,
            userId: req.userId
        });

        res.json({
            ...analysisResult,
            creditStats: {
                cost: amount,
                remainingBalance: creditResult.balance,
                purchasedBalance: creditResult.purchased_balance
            }
        });
    } catch (err) {
        console.error('[OCR] Analysis error details:', {
            message: err.message,
            stack: err.stack,
            tenantId: req.tenantId,
            userId: req.user?.id,
            file: req.file?.originalname
        });
        
        // 詳細なエラーをシステムログに保存
        await logService.error({
            message: `OCR Analysis failed: ${err.message}`,
            stack: err.stack,
            source: 'server_ocr_analyze',
            tenantId: req.tenantId,
            userId: req.user?.id,
            path: req.path,
            method: req.method
        });

        next(err);
    }
});

/**
 * POST /api/ocr/bulk-register
 * 一括OCR登録（ファイル数分クレジット消費）
 * ストレージ上のファイルを順次解析し、結果のリストを返します。
 */
router.post('/bulk-register', authMiddleware, checkTrialLimit, async (req, res, next) => {
    try {
        const { fileIds = [] } = req.body;
        if (fileIds.length === 0) {
            throw new AppError('No file IDs provided', 400, 'NO_FILES');
        }

        const required = fileIds.length;

        // テナント名、設定、クレジット残高の取得
        const [{ data: settings }, { data: tenant }, { data: credits }] = await Promise.all([
            supabaseAdmin
                .from('tenant_settings')
                .select('settings_json')
                .eq('tenant_id', req.tenantId)
                .single(),
            supabaseAdmin
                .from('tenants')
                .select('name')
                .eq('id', req.tenantId)
                .single(),
            supabaseAdmin
                .from('ai_credits')
                .select('balance')
                .eq('tenant_id', req.tenantId)
                .single()
        ]);

        const ocrMapping = settings?.settings_json?.ocrMapping || {};
        const ai_learning_hints = settings?.settings_json?.ai_learning_hints || [];
        const tenantName = tenant?.name || '';

        if (!credits || credits.balance < required) {
            throw new AppError(
                `Insufficient AI credits. Required: ${required}, Balance: ${credits?.balance || 0}`,
                402,
                'INSUFFICIENT_CREDITS'
            );
        }

        const results = [];

        // 各ファイルを順次解析
        for (const fileId of fileIds) {
            try {
                // ファイルメタ取得
                const { data: fileMeta } = await supabaseAdmin
                    .from('quotation_files')
                    .select('storage_path, original_name, mime_type')
                    .eq('id', fileId)
                    .eq('tenant_id', req.tenantId)
                    .single();

                if (!fileMeta) {
                    results.push({ id: fileId, error: 'File not found' });
                    continue;
                }

                // Storageからダウンロード
                const { data: fileData, error: downloadError } = await supabaseAdmin.storage
                    .from('quotation-files')
                    .download(fileMeta.storage_path);

                if (downloadError) {
                    console.error(`[OCR Bulk] Download failed for ${fileId}:`, downloadError);
                    results.push({ id: fileId, error: 'Download failed' });
                    continue;
                }

                // Bufferに変換
                const arrayBuffer = await fileData.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                // AI解析 (マッピング設定と自社名を渡す)
                const analysis = await aiService.analyzeDocument(buffer, fileMeta.mime_type, { ocrMapping, ai_learning_hints, name: tenantName });
                
                // 図面番号の更新とバージョン管理
                if (analysis.drawingNumber) {
                    // 同一テナント内で同じ図番の既存ファイルを検索
                    const { data: existingFiles } = await supabaseAdmin
                        .from('quotation_files')
                        .select('version')
                        .eq('tenant_id', req.tenantId)
                        .eq('drawing_number', analysis.drawingNumber)
                        .order('version', { ascending: false })
                        .limit(1);

                    const nextVersion = existingFiles && existingFiles.length > 0 ? existingFiles[0].version + 1 : 1;

                    // メタデータを更新
                    await supabaseAdmin
                        .from('quotation_files')
                        .update({
                            drawing_number: analysis.drawingNumber,
                            version: nextVersion
                        })
                        .eq('id', fileId);
                    
                    analysis.version = nextVersion;
                }

                results.push({
                    id: fileId,
                    originalName: fileMeta.original_name,
                    ...analysis
                });

            } catch (innerErr) {
                console.error(`[OCR Bulk] Error analyzing file ${fileId}:`, innerErr);
                results.push({ id: fileId, error: innerErr.message });
            }
        }

        // クレジット合計消費
        const creditResult = await creditService.consumeCredits(
            req.tenantId,
            req.user.id,
            required,
            `一括OCR解析 (${required}件)`
        );

        await logService.audit({
            action: 'ocr_bulk_processed',
            entityType: 'ocr',
            description: `一括OCR解析完了: ${required}件`,
            tenantId: req.tenantId,
            userId: req.userId
        });

        res.json({
            results,
            creditStats: {
                totalCost: required,
                remainingBalance: creditResult.balance,
                purchasedBalance: creditResult.purchased_balance
            }
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
