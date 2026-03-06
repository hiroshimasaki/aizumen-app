-- =============================================
-- AiZumen SaaS - フォーラム違反報告機能
-- =============================================

CREATE TABLE IF NOT EXISTS forum_reports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL,
    post_id     UUID REFERENCES forum_posts(id) ON DELETE CASCADE,
    reply_id    UUID REFERENCES forum_replies(id) ON DELETE CASCADE,
    reason      VARCHAR(50) NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'other')),
    details     TEXT,
    status      VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    -- post_id か reply_id のいずれか一方は必須
    CONSTRAINT check_target CHECK (
        (post_id IS NOT NULL AND reply_id IS NULL) OR
        (post_id IS NULL AND reply_id IS NOT NULL)
    ),
    -- 同一ユーザーが同じ対象を複数回通報できないよう制約
    CONSTRAINT unique_post_report UNIQUE (reporter_id, post_id),
    CONSTRAINT unique_reply_report UNIQUE (reporter_id, reply_id)
);

CREATE INDEX IF NOT EXISTS idx_forum_reports_status ON forum_reports(status);
CREATE INDEX IF NOT EXISTS idx_forum_reports_post ON forum_reports(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_forum_reports_reply ON forum_reports(reply_id) WHERE reply_id IS NOT NULL;
