-- quotation_items テーブルに寸法カラムを追加
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS dimensions VARCHAR(500) DEFAULT '';
