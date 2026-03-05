-- =============================================
-- ユーザーロールの手動更新用SQL
-- =============================================

-- 1. 以下の '対象のメールアドレス' を変更したいユーザーのメールアドレスに書き換えて実行してください。
DO $$
DECLARE
    target_email TEXT := '対象のメールアドレス'; -- 例: 'admin@example.com'
    target_id UUID;
BEGIN
    -- ユーザーIDの取得
    SELECT id INTO target_id FROM auth.users WHERE email = target_email;
    
    IF target_id IS NULL THEN
        RAISE NOTICE 'ユーザーが見つかりませんでした: %', target_email;
    ELSE
        -- public.users (プロフィール) の更新
        UPDATE public.users 
        SET role = 'system_admin', 
            updated_at = NOW() 
        WHERE id = target_id;
        
        -- auth.users (認証メタデータ) の更新
        -- ※アプリはこのメタデータを参照して権限チェックを行っています
        UPDATE auth.users 
        SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', 'system_admin')
        WHERE id = target_id;
        
        RAISE NOTICE 'ユーザー % (ID: %) を system_admin に更新しました。', target_email, target_id;
    END IF;
END $$;

/*
【重要】
SQL実行後、反映させるために以下の操作を行ってください：
1. 対象のユーザーで一度ログアウトする
2. 再度ログインし直す
（ログイン時に発行される新しいトークンに、更新後の権限情報が含まれるためです）
*/
