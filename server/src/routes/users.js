const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const authService = require('../services/authService');
const { supabaseAdmin } = require('../config/supabase');
const logService = require('../services/logService');

/**
 * GET /api/users
 * テナント内ユーザー一覧（admin専用）
 */
router.get('/', authMiddleware, requireRole('admin', 'system_admin'), async (req, res, next) => {
    try {
        console.log('[API/Users] Fetching users for tenant:', req.tenantId);
        let users = await authService.listUsers(req.tenantId);

        if (!users || users.length === 0) {
            console.log('[API/Users] No users found for tenant. Attempting to ensure admin profile exists.');
            // 現在のログインユーザー自身をusersテーブルに確実に存在させる
            const { data: profile } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('id', req.user.id)
                .single();

            if (!profile) {
                console.log('[API/Users] Admin profile missing in public.users. Creating it now...');
                await supabaseAdmin
                    .from('users')
                    .insert({
                        id: req.user.id,
                        tenant_id: req.tenantId,
                        email: req.user.email,
                        name: req.user.user_metadata?.name || 'Admin',
                        role: 'admin'
                    });
                // 再取得
                users = await authService.listUsers(req.tenantId);
            }
        }

        console.log('[API/Users] Found users count:', users?.length);
        res.json(users);
    } catch (err) {
        console.error('[API/Users] Error:', err);
        next(err);
    }
});


/**
 * POST /api/users/invite
 * ユーザー招待（admin専用）
 */
router.post('/invite', authMiddleware, requireRole('system_admin'), async (req, res, next) => {
    try {
        const { employeeId, name, role } = req.body;
        const result = await authService.inviteUser(req.tenantId, { employeeId, name, role });

        await logService.audit({
            action: 'user_invited',
            entityType: 'user',
            entityId: result.user?.id,
            description: `ユーザー招待: ${name} (${role})`,
            tenantId: req.tenantId,
            userId: req.userId
        });

        res.status(201).json(result);
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /api/users/:id
 * ユーザー情報更新（admin専用）
 */
router.put('/:id', authMiddleware, requireRole('system_admin'), async (req, res, next) => {
    try {
        const { name, role, isActive } = req.body;
        const updated = await authService.updateUser(req.tenantId, req.params.id, { name, role, isActive });

        await logService.audit({
            action: 'user_updated',
            entityType: 'user',
            entityId: req.params.id,
            description: `ユーザー情報更新: ${name} (有効状態: ${isActive})`,
            tenantId: req.tenantId,
            userId: req.userId
        });

        res.json(updated);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/users/:id/reset-password
 * ユーザーのパスワード再設定（admin専用）
 */
router.post('/:id/reset-password', authMiddleware, requireRole('system_admin'), async (req, res, next) => {
    try {
        const { newPassword } = req.body;
        const result = await authService.resetUserPassword(req.tenantId, req.params.id, newPassword);

        await logService.audit({
            action: 'user_password_reset',
            entityType: 'user',
            entityId: req.params.id,
            description: `ユーザーのパスワードを管理者がリセット`,
            tenantId: req.tenantId,
            userId: req.userId
        });

        res.json(result);
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/users/:id
 * ユーザーの物理削除（admin専用）
 */
router.delete('/:id', authMiddleware, requireRole('system_admin'), async (req, res, next) => {
    try {
        const result = await authService.deleteUser(req.tenantId, req.params.id, req.user.id);

        await logService.audit({
            action: 'user_deleted',
            entityType: 'user',
            entityId: req.params.id,
            description: `ユーザーを物理削除`,
            tenantId: req.tenantId,
            userId: req.userId
        });

        res.json(result);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
