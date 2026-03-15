-- quotation_items テーブルに検算フラグを追加
ALTER TABLE quotation_items ADD COLUMN requires_verification BOOLEAN DEFAULT false;

-- コメント追加
COMMENT ON COLUMN quotation_items.requires_verification IS 'AIによる検算で不整合が疑われる場合にtrue';
