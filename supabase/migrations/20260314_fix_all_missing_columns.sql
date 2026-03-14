-- quotation_items テーブルの不足カラムを一括追加
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS dimensions VARCHAR(500) DEFAULT '';
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS heat_treatment JSONB;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS scheduled_end_date DATE;

-- コメントの追加
COMMENT ON COLUMN quotation_items.dimensions IS '部品の寸法情報';
COMMENT ON COLUMN quotation_items.heat_treatment IS '熱処理情報 (N/H, 硬度, 委託先等)';
COMMENT ON COLUMN quotation_items.scheduled_end_date IS '完了予定日';
