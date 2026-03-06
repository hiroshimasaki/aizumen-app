-- =============================================
-- AiZumen SaaS - フォーラム機能
-- ユーザー間の質問・改善提案コミュニティ
-- =============================================

-- フォーラム投稿
CREATE TABLE IF NOT EXISTS forum_posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    user_name   VARCHAR(255) NOT NULL DEFAULT '',
    tenant_name VARCHAR(255) NOT NULL DEFAULT '',
    category    VARCHAR(50) NOT NULL DEFAULT 'question'
                CHECK (category IN ('question', 'suggestion', 'tips', 'other')),
    title       VARCHAR(500) NOT NULL,
    body        TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT false,
    like_count  INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_category ON forum_posts(category);
CREATE INDEX IF NOT EXISTS idx_forum_posts_user ON forum_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_created ON forum_posts(created_at DESC);

-- フォーラム返信
CREATE TABLE IF NOT EXISTS forum_replies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL,
    user_name   VARCHAR(255) NOT NULL DEFAULT '',
    tenant_name VARCHAR(255) NOT NULL DEFAULT '',
    body        TEXT NOT NULL,
    like_count  INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_replies_post ON forum_replies(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_forum_replies_user ON forum_replies(user_id);

-- フォーラムいいね（投稿・返信の両方に対応）
CREATE TABLE IF NOT EXISTS forum_likes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    post_id     UUID REFERENCES forum_posts(id) ON DELETE CASCADE,
    reply_id    UUID REFERENCES forum_replies(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    -- 同一ユーザーが同一対象に複数いいねできないよう制約
    CONSTRAINT unique_post_like UNIQUE (user_id, post_id),
    CONSTRAINT unique_reply_like UNIQUE (user_id, reply_id),
    -- post_id か reply_id のいずれか一方は必須
    CONSTRAINT check_target CHECK (
        (post_id IS NOT NULL AND reply_id IS NULL) OR
        (post_id IS NULL AND reply_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_forum_likes_post ON forum_likes(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_forum_likes_reply ON forum_likes(reply_id) WHERE reply_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_forum_likes_user ON forum_likes(user_id);

-- 返信数を増やす関数
CREATE OR REPLACE FUNCTION increment_reply_count(post_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE forum_posts
    SET reply_count = reply_count + 1
    WHERE id = post_uuid;
END;
$$ LANGUAGE plpgsql;

