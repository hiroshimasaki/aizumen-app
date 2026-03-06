const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const backupService = require('../services/backupService');
const { AppError } = require('../middleware/errorHandler');
const logService = require('../services/logService');

/**
 * GET /api/backups
 * バックアップ一覧を取得
 */
router.get('/', authMiddleware, requireRole('system_admin'), async (req, res, next) => {
    try {
        const backups = await backupService.listBackups(req.tenantId);
        res.json(backups);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/backups/:fileName/download
 * バックアップファイルのダウンロードURLを取得
 */
router.get('/:fileName/download', authMiddleware, requireRole('system_admin'), async (req, res, next) => {
    try {
        const url = await backupService.getBackupFileUrl(req.tenantId, req.params.fileName);
        res.json({ url });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/backups
 * 手動でバックアップを実行
 */
router.post('/', authMiddleware, requireRole('system_admin'), async (req, res, next) => {
    try {
        const result = await backupService.runTenantBackup(req.tenantId);

        await logService.audit({
            action: 'backup_executed',
            entityType: 'backup',
            description: `Manual backup executed for tenant`,
            tenantId: req.tenantId,
            userId: req.userId
        });

        res.json(result);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
