-- 無料プランのトライアル期限カラム追加
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT NULL;

-- コメント
COMMENT ON COLUMN tenants.trial_ends_at IS '無料トライアルの終了日時。NULLの場合はトライアルなし（有料プラン）';
