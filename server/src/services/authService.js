const { supabaseAdmin } = require('../config/supabase');
const { PLAN_CONFIG } = require('../config/stripe');
const { AppError } = require('../middleware/errorHandler');

/**
 * テナントとadminユーザーの同時作成（サインアップ）
 */
async function signUp({ email, password, userName, companyName, companyCode, plan = 'free' }) {
    // バリデーション
    if (!email || !password || !userName || !companyName || !companyCode) {
        throw new AppError('All fields are required', 400, 'VALIDATION_ERROR');
    }
    if (password.length < 8) {
        throw new AppError('Password must be at least 8 characters', 400, 'VALIDATION_ERROR');
    }

    const planConfig = PLAN_CONFIG[plan];
    if (!planConfig) {
        throw new AppError('Invalid plan', 400, 'INVALID_PLAN');
    }

    // テナント作成
    const slug = companyCode.toLowerCase().replace(/[^a-z0-9\-]/g, '');

    // トライアル期限の計算（freeプランの場合）
    const trialEndsAt = planConfig.trialDays
        ? new Date(Date.now() + planConfig.trialDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const { data: tenant, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .insert({
            name: companyName,
            slug: slug,
            plan: plan,
            trial_ends_at: trialEndsAt,
        })
        .select()
        .single();

    if (tenantError) {
        console.error('[Auth Service] Tenant creation error:', tenantError);
        if (tenantError.code === '23505') {
            throw new AppError('この会社コードは既に登録されています', 409, 'DUPLICATE_TENANT_CODE');
        }
        throw new AppError('Failed to create tenant', 500, 'TENANT_CREATION_FAILED');
    }

    // Supabase Auth ユーザー作成
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // メール確認をスキップ（開発用、本番では要検討）
        app_metadata: {
            tenant_id: tenant.id,
            role: 'system_admin',
        },
    });

    if (authError) {
        // ロールバック：テナントを削除
        await supabaseAdmin.from('tenants').delete().eq('id', tenant.id);
        if (authError.message?.includes('already been registered')) {
            throw new AppError('Email already registered', 409, 'DUPLICATE_EMAIL');
        }
        throw new AppError('Failed to create user account', 500, 'AUTH_CREATION_FAILED');
    }

    // usersテーブルにプロフィール情報を保存
    const { error: profileError } = await supabaseAdmin
        .from('users')
        .insert({
            id: authData.user.id,
            tenant_id: tenant.id,
            email,
            name: userName,
            role: 'system_admin',
        });

    if (profileError) {
        console.error('[Auth Service] Profile creation failed:', profileError);
        // Auth ユーザーとテナントをロールバック
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        await supabaseAdmin.from('tenants').delete().eq('id', tenant.id);
        throw new AppError('Failed to create user profile', 500, 'PROFILE_CREATION_FAILED');
    }

    // テナント設定を初期化
    await supabaseAdmin.from('tenant_settings').insert({
        tenant_id: tenant.id,
    });

    // AIクレジットを初期化（サインアップボーナス込み）
    const SIGNUP_BONUS = 10;
    const initialBalance = planConfig.monthlyCredits + SIGNUP_BONUS;

    const { error: aiCreditsError } = await supabaseAdmin.from('ai_credits').upsert({
        tenant_id: tenant.id,
        balance: initialBalance,
        monthly_quota: planConfig.monthlyCredits,
        purchased_balance: SIGNUP_BONUS,
        last_reset_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' });

    if (aiCreditsError) {
        console.error('[Auth Service] Initial AI Credits upsert failed:', aiCreditsError);
    }

    // ボーナスクレジットのトランザクション記録
    await supabaseAdmin.from('ai_credit_transactions').insert({
        tenant_id: tenant.id,
        user_id: authData.user.id,
        type: 'signup_bonus',
        amount: SIGNUP_BONUS,
        description: '新規登録ボーナスクレジット',
    });

    return {
        tenant,
        user: {
            id: authData.user.id,
            email,
            name: userName,
            role: 'system_admin',
        },
    };
}

/**
 * ユーザー招待 / 追加（admin専用）
 * employeeId を使用してダミーメールアドレスを生成し、Supabase Auth に登録する
 */
async function inviteUser(tenantId, { employeeId, name, role = 'user' }) {
    if (!employeeId || !name) {
        throw new AppError('Employee ID and name are required', 400, 'VALIDATION_ERROR');
    }

    if (!['system_admin', 'admin', 'user'].includes(role)) {
        throw new AppError('Invalid role', 400, 'INVALID_ROLE');
    }

    // ライセンス数チェック
    const { count: userCount } = await supabaseAdmin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

    const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('max_users')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .single();

    // デフォルト値 (free: 1)
    let maxUsers = 1;
    if (sub?.max_users) {
        maxUsers = sub.max_users;
    } else {
        // テナント自身のプラン設定からも確認
        const { data: t } = await supabaseAdmin.from('tenants').select('plan').eq('id', tenantId).single();
        const { PLAN_CONFIG } = require('../config/stripe');
        const planConfig = PLAN_CONFIG[t?.plan || 'free'];
        if (planConfig) maxUsers = planConfig.maxUsers;
    }

    if (userCount >= maxUsers) {
        throw new AppError(
            `ユーザー数の上限に達しています (${userCount}/${maxUsers})。プランをアップグレードするか、不要なユーザーを無効化してください。`,
            403,
            'LICENSE_LIMIT'
        );
    }

    // テナント情報を取得してダミーメールを生成
    const { data: tenant } = await supabaseAdmin.from('tenants').select('slug').eq('id', tenantId).single();
    if (!tenant) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');

    // 従業員IDの重複チェック
    const { data: existingUser } = await supabaseAdmin.from('users').select('id').eq('tenant_id', tenantId).eq('employee_id', employeeId).maybeSingle();
    if (existingUser) {
        throw new AppError('この従業員番号は既に登録されています。', 409, 'DUPLICATE_EMPLOYEE_ID');
    }

    const email = `${employeeId}@${tenant.slug}.aizumen.local`;

    // 仮パスワードでユーザー作成
    const tempPassword = generateTempPassword();
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        app_metadata: {
            tenant_id: tenantId,
            role: role,
        },
    });

    if (authError) {
        if (authError.message?.includes('already been registered')) {
            throw new AppError('Email already registered', 409, 'DUPLICATE_EMAIL');
        }
        throw new AppError('Failed to create user', 500, 'USER_CREATION_FAILED');
    }

    // usersテーブルに保存
    const { data: userProfile, error: profileError } = await supabaseAdmin
        .from('users')
        .insert({
            id: authData.user.id,
            tenant_id: tenantId,
            email,
            name,
            role,
            employee_id: employeeId,
        })
        .select()
        .single();

    if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw new AppError('Failed to create user profile', 500, 'PROFILE_CREATION_FAILED');
    }

    // TODO: 招待メール送信（仮パスワード or パスワードリセットリンク）

    return {
        user: userProfile,
        tempPassword, // 開発用。本番ではメール送信に切り替え
    };
}

/**
 * テナント内のユーザー一覧
 */
async function listUsers(tenantId) {
    console.log('[AuthService] listUsers query for tenant:', tenantId);
    const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, email, name, role, is_active, created_at, employee_id')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[AuthService] listUsers error:', error);
        throw new AppError('Failed to fetch users', 500, 'FETCH_FAILED');
    }
    return data;
}

/**
 * ユーザー情報更新（admin専用）
 */
async function updateUser(tenantId, userId, { name, role, isActive }) {
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) {
        if (!['system_admin', 'admin', 'user'].includes(role)) {
            throw new AppError('Invalid role', 400, 'INVALID_ROLE');
        }
        updates.role = role;
    }
    if (isActive !== undefined) updates.is_active = isActive;
    updates.updated_at = new Date().toISOString();

    if (role !== undefined || isActive !== undefined) {
        const { data: currentUser } = await supabaseAdmin
            .from('users')
            .select('role, is_active')
            .eq('id', userId)
            .eq('tenant_id', tenantId)
            .single();

        if (currentUser) {
            // システム管理者が無効化またはロール変更される場合
            if (currentUser.role === 'system_admin' && currentUser.is_active && (role !== 'system_admin' || isActive === false)) {
                const { count } = await supabaseAdmin
                    .from('users')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('role', 'system_admin')
                    .eq('is_active', true);

                if (count <= 1) {
                    throw new AppError('テナントには少なくとも1名の有効なシステム管理者が必要です。', 400, 'LAST_SYSTEM_ADMIN_RESTRICTION');
                }
            }
        }
    }

    const { data, error } = await supabaseAdmin
        .from('users')
        .update(updates)
        .eq('id', userId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

    if (error) {
        console.error('[AuthService] Update failed:', error);
        throw new AppError('Failed to update user', 500, 'UPDATE_FAILED');
    }
    if (!data) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    // app_metadataも同期
    if (role !== undefined || isActive !== undefined) {
        // 既存のメタデータを取得して、tenant_id などを維持する
        const { data: authUser, error: getAuthError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (getAuthError) {
            console.error('[AuthService] Failed to get auth user:', getAuthError);
        }

        const currentMeta = authUser?.user?.app_metadata || {};
        const metaUpdate = { ...currentMeta };
        if (role !== undefined) metaUpdate.role = role;

        await supabaseAdmin.auth.admin.updateUserById(userId, {
            app_metadata: metaUpdate,
            // isActive が false の場合は非常に長い期間BANする (100年 = 876000時間)
            // isActive が true の場合はBAN解除 (0)
            ban_duration: isActive === false ? '876000h' : '0h',
        });

        // ※管理者が無効化・ロール変更した際、最新バージョンのSupabaseでは強制ログアウトさせる signOut(userId) が利用できる場合がありますが、
        // 互換性のため、ここでは authMiddleware での DB 状態チェック（isActive確認）に委ねます。
    }

    return data;
}

/**
 * 仮パスワード生成
 */
function generateTempPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

/**
 * 管理者によるパスワード再設定（任意文字列）
 */
async function resetUserPassword(tenantId, userId, newPassword) {
    if (!newPassword || newPassword.length < 8) {
        throw new AppError('パスワードは8文字以上で設定してください', 400, 'VALIDATION_ERROR');
    }

    // 対象ユーザーが同一テナントか確認
    const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('id, name, tenant_id')
        .eq('id', userId)
        .eq('tenant_id', tenantId)
        .single();

    if (error || !user) {
        throw new AppError('対象ユーザーが見つかりません', 404, 'USER_NOT_FOUND');
    }

    // Supabase Auth でパスワードを更新
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
    });

    if (updateError) {
        console.error('[AuthService] Password reset failed:', updateError);
        throw new AppError('パスワードの再設定に失敗しました', 500, 'PASSWORD_RESET_FAILED');
    }

    return {
        userName: user.name,
        // パスワードは画面に返さず成功メッセージのみ返す
        message: 'Password reset successful',
    };
}

/**
 * ユーザー物理削除（admin専用）
 */
async function deleteUser(tenantId, targetUserId, requestingUserId) {
    // 自身の削除禁止
    if (targetUserId === requestingUserId) {
        throw new AppError('自分自身のアカウントは削除できません', 400, 'CANNOT_DELETE_SELF');
    }

    // 対象ユーザーが属しているか、ロール・ステータスを取得
    const { data: targetUser, error: findError } = await supabaseAdmin
        .from('users')
        .select('role, is_active')
        .eq('id', targetUserId)
        .eq('tenant_id', tenantId)
        .single();

    if (findError || !targetUser) {
        throw new AppError('削除対象のユーザーが見つかりません', 404, 'USER_NOT_FOUND');
    }

    // 対象が「有効なシステム管理者」である場合、最後のシステム管理者ではないかチェック
    if (targetUser.role === 'system_admin' && targetUser.is_active) {
        const { count } = await supabaseAdmin
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('role', 'system_admin')
            .eq('is_active', true);

        if (count <= 1) {
            throw new AppError('テナントには少なくとも1名の有効なシステム管理者が必須です', 400, 'LAST_SYSTEM_ADMIN_RESTRICTION');
        }
    }

    // Supabase Authから削除
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (deleteAuthError) {
        console.error('[AuthService] Delete user from auth failed:', deleteAuthError);
        throw new AppError('ユーザーの削除に失敗しました (Auth)', 500, 'DELETE_AUTH_FAILED');
    }

    // public.users から削除 (大抵は Auth 删除時にトリガー等で消える設定になっていることが多いが、安全のため明示的に削除)
    const { error: deleteTableError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', targetUserId)
        .eq('tenant_id', tenantId);

    if (deleteTableError) {
        console.error('[AuthService] Delete user from table failed:', deleteTableError);
        throw new AppError('ユーザーの削除に失敗しました (DB)', 500, 'DELETE_DB_FAILED');
    }

    return { message: 'User deleted successfully' };
}

module.exports = {
    signUp,
    inviteUser,
    listUsers,
    updateUser,
    resetUserPassword,
    deleteUser,
};
