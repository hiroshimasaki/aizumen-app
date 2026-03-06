const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const { AppError } = require('../middleware/errorHandler');

const PAGE_SIZE = 20;

/**
 * GET /api/forum
 * 投稿一覧（ページネーション・カテゴリフィルタ・検索対応）
 */
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const { page = 1, category, search, sortBy = 'created_at', sortDir = 'desc' } = req.query;
        const from = (parseInt(page) - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let query = supabaseAdmin
            .from('forum_posts')
            .select('*', { count: 'exact' });

        if (category && category !== 'all') {
            query = query.eq('category', category);
        }

        if (search) {
            query = query.or(`title.ilike.%${search}%,body.ilike.%${search}%`);
        }

        const { data, count, error } = await query
            .order(sortBy, { ascending: sortDir === 'asc' })
            .range(from, to);

        if (error) throw new AppError('Failed to fetch forum posts', 500, 'FETCH_FAILED');

        // 現在のユーザーのいいね状態を取得
        const postIds = data.map(p => p.id);
        let userLikes = [];
        if (postIds.length > 0) {
            const { data: likes } = await supabaseAdmin
                .from('forum_likes')
                .select('post_id')
                .eq('user_id', req.userId)
                .in('post_id', postIds);
            userLikes = (likes || []).map(l => l.post_id);
        }

        const postsWithLikeStatus = data.map(p => ({
            ...p,
            liked_by_me: userLikes.includes(p.id),
        }));

        res.json({
            data: postsWithLikeStatus,
            total: count,
            page: parseInt(page),
            pageSize: PAGE_SIZE,
            totalPages: Math.ceil(count / PAGE_SIZE),
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/forum/:id
 * 投稿詳細 + 返信一覧
 */
router.get('/:id', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { data: post, error } = await supabaseAdmin
            .from('forum_posts')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !post) throw new AppError('Post not found', 404, 'NOT_FOUND');

        // 返信一覧
        const { data: replies } = await supabaseAdmin
            .from('forum_replies')
            .select('*')
            .eq('post_id', id)
            .order('created_at', { ascending: true });

        // いいね状態（投稿+返信）
        const { data: postLike } = await supabaseAdmin
            .from('forum_likes')
            .select('id')
            .eq('user_id', req.userId)
            .eq('post_id', id)
            .maybeSingle();

        const replyIds = (replies || []).map(r => r.id);
        let replyLikes = [];
        if (replyIds.length > 0) {
            const { data: rLikes } = await supabaseAdmin
                .from('forum_likes')
                .select('reply_id')
                .eq('user_id', req.userId)
                .in('reply_id', replyIds);
            replyLikes = (rLikes || []).map(l => l.reply_id);
        }

        // いいねしたユーザー一覧
        const { data: likeUsers } = await supabaseAdmin
            .from('forum_likes')
            .select('user_id, created_at')
            .eq('post_id', id)
            .order('created_at', { ascending: false });

        res.json({
            ...post,
            liked_by_me: !!postLike,
            like_users: likeUsers || [],
            replies: (replies || []).map(r => ({
                ...r,
                liked_by_me: replyLikes.includes(r.id),
            })),
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/forum
 * 新規投稿
 */
router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const { title, body, category = 'question' } = req.body;

        if (!title || !body) {
            throw new AppError('Title and body are required', 400, 'VALIDATION_ERROR');
        }

        // ユーザー名・テナント名を取得
        const { userName, tenantName } = await getUserDisplayInfo(req.userId);

        const { data, error } = await supabaseAdmin
            .from('forum_posts')
            .insert({
                user_id: req.userId,
                user_name: userName,
                tenant_name: tenantName,
                category,
                title,
                body,
            })
            .select()
            .single();

        if (error) throw new AppError('Failed to create post', 500, 'CREATE_FAILED');
        res.status(201).json(data);
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /api/forum/:id
 * 投稿の編集（本人のみ）
 */
router.put('/:id', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, body, category } = req.body;

        // 投稿者チェック
        const { data: post } = await supabaseAdmin
            .from('forum_posts')
            .select('user_id')
            .eq('id', id)
            .single();

        if (!post) throw new AppError('Post not found', 404, 'NOT_FOUND');
        if (post.user_id !== req.userId) {
            throw new AppError('Only the author can edit this post', 403, 'FORBIDDEN');
        }

        const updates = { updated_at: new Date().toISOString() };
        if (title !== undefined) updates.title = title;
        if (body !== undefined) updates.body = body;
        if (category !== undefined) updates.category = category;

        const { data, error } = await supabaseAdmin
            .from('forum_posts')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new AppError('Failed to update post', 500, 'UPDATE_FAILED');
        res.json(data);
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/forum/:id
 * 投稿の削除（本人 or super_admin）
 */
router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { data: post } = await supabaseAdmin
            .from('forum_posts')
            .select('user_id')
            .eq('id', id)
            .single();

        if (!post) throw new AppError('Post not found', 404, 'NOT_FOUND');
        if (post.user_id !== req.userId && req.userRole !== 'super_admin') {
            throw new AppError('Permission denied', 403, 'FORBIDDEN');
        }

        if (req.userRole === 'super_admin' && post.user_id !== req.userId) {
            // 管理者による他人の投稿削除の場合は論理削除（文言変更）とする
            const { error } = await supabaseAdmin
                .from('forum_posts')
                .update({
                    title: '[管理者によって削除されました]',
                    body: '[管理者によって削除されました]',
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);
            
            if (error) throw new AppError('Failed to overwrite post', 500, 'UPDATE_FAILED');
        } else {
            // 本人の場合は通常通り物理削除
            const { error } = await supabaseAdmin
                .from('forum_posts')
                .delete()
                .eq('id', id);
            
            if (error) throw new AppError('Failed to delete post', 500, 'DELETE_FAILED');
        }

        if (error) throw new AppError('Failed to delete post', 500, 'DELETE_FAILED');
        res.json({ message: 'Post deleted' });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/forum/:id/replies
 * 返信の投稿
 */
router.post('/:id/replies', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { body } = req.body;

        if (!body) throw new AppError('Body is required', 400, 'VALIDATION_ERROR');

        const { userName, tenantName } = await getUserDisplayInfo(req.userId);

        const { data, error } = await supabaseAdmin
            .from('forum_replies')
            .insert({
                post_id: id,
                user_id: req.userId,
                user_name: userName,
                tenant_name: tenantName,
                body,
            })
            .select()
            .single();

        if (error) throw new AppError('Failed to create reply', 500, 'CREATE_FAILED');

        // 返信数を更新
        const { error: rpcError } = await supabaseAdmin.rpc('increment_reply_count', { post_uuid: id });
        if (rpcError) {
            console.error('[Forum API] RPC increment failed, using fallback:', rpcError.message);
            // フォールバック: 直接カウントを再計算して更新
            const { count } = await supabaseAdmin
                .from('forum_replies')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', id);
            await supabaseAdmin
                .from('forum_posts')
                .update({ reply_count: count || 0 })
                .eq('id', id);
        }

        res.status(201).json(data);
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /api/forum/replies/:replyId
 * 返信の編集（本人のみ）
 */
router.put('/replies/:replyId', authMiddleware, async (req, res, next) => {
    try {
        const { replyId } = req.params;
        const { body } = req.body;

        const { data: reply } = await supabaseAdmin
            .from('forum_replies')
            .select('user_id')
            .eq('id', replyId)
            .single();

        if (!reply) throw new AppError('Reply not found', 404, 'NOT_FOUND');
        if (reply.user_id !== req.userId) {
            throw new AppError('Only the author can edit this reply', 403, 'FORBIDDEN');
        }

        const { data, error } = await supabaseAdmin
            .from('forum_replies')
            .update({ body, updated_at: new Date().toISOString() })
            .eq('id', replyId)
            .select()
            .single();

        if (error) throw new AppError('Failed to update reply', 500, 'UPDATE_FAILED');
        res.json(data);
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/forum/replies/:replyId
 * 返信の削除（本人 or super_admin）
 */
router.delete('/replies/:replyId', authMiddleware, async (req, res, next) => {
    try {
        const { replyId } = req.params;

        const { data: reply } = await supabaseAdmin
            .from('forum_replies')
            .select('user_id, post_id')
            .eq('id', replyId)
            .single();

        if (!reply) throw new AppError('Reply not found', 404, 'NOT_FOUND');
        if (reply.user_id !== req.userId && req.userRole !== 'super_admin') {
            throw new AppError('Permission denied', 403, 'FORBIDDEN');
        }

        if (req.userRole === 'super_admin' && reply.user_id !== req.userId) {
            // 管理者による他人の返信削除の場合は論理削除（文言変更）とする
            const { error } = await supabaseAdmin
                .from('forum_replies')
                .update({
                    body: '[管理者によって削除されました]',
                    updated_at: new Date().toISOString()
                })
                .eq('id', replyId);
            
            if (error) throw new AppError('Failed to overwrite reply', 500, 'UPDATE_FAILED');
        } else {
            // 本人の場合は物理削除
            const { error } = await supabaseAdmin
                .from('forum_replies')
                .delete()
                .eq('id', replyId);
            
            if (error) throw new AppError('Failed to delete reply', 500, 'DELETE_FAILED');
        }

        // 返信数を更新
        const { count } = await supabaseAdmin
            .from('forum_replies')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', reply.post_id);
        await supabaseAdmin
            .from('forum_posts')
            .update({ reply_count: count || 0 })
            .eq('id', reply.post_id);

        res.json({ message: 'Reply deleted' });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/forum/:id/like
 * 投稿へのいいねトグル
 */
router.post('/:id/like', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { data: existing } = await supabaseAdmin
            .from('forum_likes')
            .select('id')
            .eq('user_id', req.userId)
            .eq('post_id', id)
            .maybeSingle();

        if (existing) {
            // いいね解除
            await supabaseAdmin.from('forum_likes').delete().eq('id', existing.id);
        } else {
            // いいね追加
            await supabaseAdmin.from('forum_likes').insert({
                user_id: req.userId,
                post_id: id,
            });
        }

        // カウント更新
        const { count } = await supabaseAdmin
            .from('forum_likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', id);

        await supabaseAdmin
            .from('forum_posts')
            .update({ like_count: count || 0 })
            .eq('id', id);

        res.json({ liked: !existing, like_count: count || 0 });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/forum/replies/:replyId/like
 * 返信へのいいねトグル
 */
router.post('/replies/:replyId/like', authMiddleware, async (req, res, next) => {
    try {
        const { replyId } = req.params;

        const { data: existing } = await supabaseAdmin
            .from('forum_likes')
            .select('id')
            .eq('user_id', req.userId)
            .eq('reply_id', replyId)
            .maybeSingle();

        if (existing) {
            await supabaseAdmin.from('forum_likes').delete().eq('id', existing.id);
        } else {
            await supabaseAdmin.from('forum_likes').insert({
                user_id: req.userId,
                reply_id: replyId,
            });
        }

        const { count } = await supabaseAdmin
            .from('forum_likes')
            .select('*', { count: 'exact', head: true })
            .eq('reply_id', replyId);

        await supabaseAdmin
            .from('forum_replies')
            .update({ like_count: count || 0 })
            .eq('id', replyId);

        res.json({ liked: !existing, like_count: count || 0 });
    } catch (err) {
        next(err);
    }
});

/**
 * PATCH /api/forum/:id/resolve
 * 解決済みマーク（投稿者のみ）
 */
router.patch('/:id/resolve', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { data: post } = await supabaseAdmin
            .from('forum_posts')
            .select('user_id, is_resolved')
            .eq('id', id)
            .single();

        if (!post) throw new AppError('Post not found', 404, 'NOT_FOUND');
        if (post.user_id !== req.userId) {
            throw new AppError('Only the author can resolve this post', 403, 'FORBIDDEN');
        }

        const { data, error } = await supabaseAdmin
            .from('forum_posts')
            .update({ is_resolved: !post.is_resolved, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw new AppError('Failed to update post', 500, 'UPDATE_FAILED');
        res.json(data);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/forum/:id/report
 * 投稿を通報
 */
router.post('/:id/report', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason, details } = req.body;

        if (!reason) throw new AppError('Reason is required', 400, 'VALIDATION_ERROR');

        const { error } = await supabaseAdmin
            .from('forum_reports')
            .insert({
                reporter_id: req.userId,
                post_id: id,
                reason,
                details
            });

        if (error) {
            if (error.code === '23505') {
                throw new AppError('You have already reported this post', 400, 'ALREADY_REPORTED');
            }
            throw new AppError('Failed to submit report', 500, 'REPORT_FAILED');
        }

        res.status(201).json({ message: 'Report submitted successfully' });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/forum/replies/:replyId/report
 * 返信を通報
 */
router.post('/replies/:replyId/report', authMiddleware, async (req, res, next) => {
    try {
        const { replyId } = req.params;
        const { reason, details } = req.body;

        if (!reason) throw new AppError('Reason is required', 400, 'VALIDATION_ERROR');

        const { error } = await supabaseAdmin
            .from('forum_reports')
            .insert({
                reporter_id: req.userId,
                reply_id: replyId,
                reason,
                details
            });

        if (error) {
            if (error.code === '23505') {
                throw new AppError('You have already reported this reply', 400, 'ALREADY_REPORTED');
            }
            throw new AppError('Failed to submit report', 500, 'REPORT_FAILED');
        }

        res.status(201).json({ message: 'Report submitted successfully' });
    } catch (err) {
        next(err);
    }
});

/**
 * ユーザーの表示情報を取得するヘルパー
 */
async function getUserDisplayInfo(userId) {
    // まずusersテーブルから取得
    const { data: user } = await supabaseAdmin
        .from('users')
        .select('name, tenant_id')
        .eq('id', userId)
        .single();

    let tenantName = '';
    if (user?.tenant_id) {
        const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('name')
            .eq('id', user.tenant_id)
            .single();
        tenantName = tenant?.name || '';
    }

    // platform_adminsの場合
    if (!user) {
        const { data: pa } = await supabaseAdmin
            .from('platform_admins')
            .select('name')
            .eq('id', userId)
            .single();
        return { userName: pa?.name || 'Admin', tenantName: 'AiZumen' };
    }

    return { userName: user?.name || 'User', tenantName };
}

module.exports = router;
