-- 図面管理および明細メタデータの拡張

-- quotation_files テーブルの拡張
ALTER TABLE quotation_files ADD COLUMN IF NOT EXISTS drawing_number VARCHAR(255);
ALTER TABLE quotation_files ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- quotation_items テーブルの拡張 (材質、加工方法、表面処理)
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS material VARCHAR(255);
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS processing_method VARCHAR(255);
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS surface_treatment VARCHAR(255);

-- quotations テーブルの拡張 (システム備考)
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS system_notes TEXT;

-- コメント追加
COMMENT ON COLUMN quotation_files.drawing_number IS '図面番号（AI抽出または手動入力）';
COMMENT ON COLUMN quotation_files.version IS '図面のバージョン（同一図番内での履歴管理用）';
COMMENT ON COLUMN quotation_items.material IS '材質（例: SS400, SUS304）';
COMMENT ON COLUMN quotation_items.processing_method IS '加工方法（例: 旋盤, フライス）';
COMMENT ON COLUMN quotation_items.surface_treatment IS '表面処理（例: メッキ, 焼入）';
COMMENT ON COLUMN quotations.system_notes IS 'システム側で生成された注意書きやAIの補足情報';
