const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { authMiddleware } = require('../middleware/auth');
const { checkTrialLimit } = require('../middleware/trialMiddleware');
const { supabaseAdmin } = require('../config/supabase');
const { AppError } = require('../middleware/errorHandler');
const { checkStorageLimit } = require('../middleware/storageLimit');
const logService = require('../services/logService');

// メモリストレージ (Supabase Storageに直接アップロードするため)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['pdf', 'dxf', 'step', 'stp'];
        const ext = file.originalname.split('.').pop().toLowerCase();

        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new AppError('対応していないファイル形式です。許可されている形式: PDF, DXF, STEP', 400, 'INVALID_FILE_TYPE'));
        }
    },
});

/**
 * POST /api/files/upload
 * 複数ファイルアップロード
 */
router.post('/upload', authMiddleware, checkTrialLimit, upload.array('files', 10), checkStorageLimit, async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            throw new AppError('No files provided', 400, 'NO_FILES');
        }

        // 合計サイズチェック (20MB)
        const totalSize = req.files.reduce((sum, f) => sum + f.size, 0);
        if (totalSize > 20 * 1024 * 1024) {
            throw new AppError('合計ファイル容量が 20MB を超えています。', 400, 'FILES_TOO_LARGE');
        }

        const { quotationId } = req.body;
        const results = [];

        for (const file of req.files) {
            const fileId = uuidv4();
            // 文字化け対策: Latin-1 → UTF-8 変換
            const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
            const ext = originalName.split('.').pop();
            const storagePath = `${req.tenantId}/${quotationId || 'pool'}/${fileId}.${ext}`;

            // ファイルハッシュ計算
            const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');

            // Supabase Storageにアップロード
            // MIMEタイプが application/octet-stream の場合、拡張子から推測して上書き (Supabaseの制限対策)
            let contentType = file.mimetype;
            if (contentType === 'application/octet-stream' || !contentType) {
                if (ext.toLowerCase() === 'dxf') contentType = 'application/dxf';
                else if (['step', 'stp'].includes(ext.toLowerCase())) contentType = 'application/step';
                else if (ext.toLowerCase() === 'pdf') contentType = 'application/pdf';
            }

            const { error: uploadError } = await supabaseAdmin.storage
                .from('quotation-files')
                .upload(storagePath, file.buffer, {
                    contentType: contentType,
                    upsert: false,
                });

            if (uploadError) {
                console.error('[Files] Upload failed:', uploadError);
                const errorMsg = uploadError.message || JSON.stringify(uploadError);
                throw new AppError(`ファイルのアップロードに失敗しました: ${originalName} (理由: ${errorMsg})`, 500, 'UPLOAD_FAILED');
            }

            // DBにメタデータ保存
            if (quotationId) {
                const { data, error: dbError } = await supabaseAdmin
                    .from('quotation_files')
                    .insert({
                        id: fileId,
                        quotation_id: quotationId,
                        tenant_id: req.tenantId,
                        storage_path: storagePath,
                        original_name: originalName,
                        file_hash: hash,
                        file_size: file.size,
                        mime_type: contentType,
                        file_type: 'attachment',
                    })
                    .select()
                    .single();

                if (dbError) {
                    console.error('[Files] DB insert failed:', dbError);
                    throw new AppError(`ファイル情報の保存に失敗しました: ${originalName}`, 500, 'DB_INSERT_FAILED');
                }
                results.push(data);
            } else {
                results.push({
                    id: fileId,
                    storagePath,
                    originalName: originalName,
                    hash,
                    size: file.size,
                    mimeType: contentType,
                });
            }
        }

        res.status(201).json({
            message: `${results.length} file(s) uploaded`,
            files: results,
        });

        await logService.audit({
            action: 'file_uploaded',
            entityType: 'file',
            description: `Uploaded ${results.length} file(s)`,
            tenantId: req.tenantId,
            userId: req.userId
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/files/:id
 * ファイル取得（署名付きURL）
 */
router.get('/:id', authMiddleware, checkTrialLimit, async (req, res, next) => {
    try {
        const { data: fileMeta, error } = await supabaseAdmin
            .from('quotation_files')
            .select('storage_path, original_name, mime_type')
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId)
            .single();

        if (error || !fileMeta) {
            throw new AppError('File not found', 404, 'NOT_FOUND');
        }

        const { data: signedUrl, error: urlError } = await supabaseAdmin.storage
            .from('quotation-files')
            .createSignedUrl(fileMeta.storage_path, 300); // 5分間有効

        if (urlError) throw new AppError('Failed to generate file URL', 500, 'URL_GENERATION_FAILED');

        res.json({
            url: signedUrl.signedUrl,
            originalName: fileMeta.original_name,
            mimeType: fileMeta.mime_type,
        });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/files/:id
 * ファイル削除
 */
router.delete('/:id', authMiddleware, checkTrialLimit, async (req, res, next) => {
    try {
        // メタデータ取得
        const { data: fileMeta } = await supabaseAdmin
            .from('quotation_files')
            .select('storage_path')
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId)
            .single();

        if (!fileMeta) throw new AppError('File not found', 404, 'NOT_FOUND');

        // Storageから削除
        await supabaseAdmin.storage
            .from('quotation-files')
            .remove([fileMeta.storage_path]);

        // DBから削除
        await supabaseAdmin
            .from('quotation_files')
            .delete()
            .eq('id', req.params.id);

        await logService.audit({
            action: 'file_deleted',
            entityType: 'file',
            entityId: req.params.id,
            description: `File deleted: ${fileMeta.storage_path.split('/').pop()}`,
            tenantId: req.tenantId,
            userId: req.userId
        });

        res.json({ message: 'File deleted' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
