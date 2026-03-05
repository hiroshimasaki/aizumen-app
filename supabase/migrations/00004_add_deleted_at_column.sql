-- quotations テーブルに削除日時カラムを追加（ゴミ箱の保存期間制限用）
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- is_deleted = true のとき deleted_at が NULL なら現在日時で埋める（既存データ対応）
UPDATE quotations SET deleted_at = updated_at WHERE is_deleted = TRUE AND deleted_at IS NULL;

-- 検索パフォーマンス向上のためのインデックス
CREATE INDEX IF NOT EXISTS idx_quotations_deleted_at ON quotations(tenant_id, deleted_at) WHERE is_deleted = TRUE;
