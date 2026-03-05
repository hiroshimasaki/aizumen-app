-- =============================================
-- Super Admin (SU) の分離と MFA 強化に向けたスキーマ変更
-- =============================================

-- 1. プラットフォーム管理者（サービス運営者）専用テーブル
CREATE TABLE public.platform_admins (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       VARCHAR(255) NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 有効化
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- SU 本人のレコードのみ参照可能にするポリシー（基本はバックエンドからのサービスロール利用）
CREATE POLICY "platform_admins_self_read" ON public.platform_admins
    FOR SELECT USING (auth.uid() = id);

-- 2. 一般利用者テーブル (users) のロール制約を再定義
-- system_admin は「自社内最強権限」として残し、内部的なチェック等は super_admin とは分ける
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('system_admin', 'admin', 'user', 'viewer'));

-- 3. プラットフォーム分離用ポリシー（追加）
-- platform_admins に所属するユーザーは一般テナントの RLS に縛られずに全データにアクセスできるパスを作るための準備
-- (※現在は既存の tenant_isolation ポリシーがあるため、SUは auth.jwt() の tenant_id が空だとアクセスできない)
-- (※バックエンド側で supabaseAdmin = Service Role を使って SU のリクエストを処理することで、この制限を回避する設計とする)

-- 4. 既存の管理者向けメッセージ等のコメント
COMMENT ON TABLE public.platform_admins IS 'サービス運営用の最上位管理者テーブル。一般テナントとは完全に隔離された権限を持つ。';
