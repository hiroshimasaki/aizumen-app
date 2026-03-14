-- quotation_items テーブルに熱処理情報カラムを追加
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS heat_treatment JSONB;

COMMENT ON COLUMN quotation_items.heat_treatment IS '熱処理情報 (種類: N/H, 目標硬度, 委託先, 直送先フラグなど)';
