-- =============================================
-- AiZumen SaaS - フォーラムお知らせ機能拡張
-- =============================================

-- forum_posts テーブルへお知らせフラグ追加
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS is_announcement BOOLEAN DEFAULT FALSE;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- インデックスの追加（ソート用）
CREATE INDEX IF NOT EXISTS idx_forum_posts_is_announcement ON forum_posts(is_announcement DESC, created_at DESC);

COMMENT ON COLUMN forum_posts.is_announcement IS '管理者によるお知らせ投稿かどうか';
COMMENT ON COLUMN forum_posts.expires_at IS 'お知らせの掲載期限（将来用）';
