-- material_prices テーブルに材料管理費係数カラムを追加
ALTER TABLE material_prices ADD COLUMN IF NOT EXISTS overhead_factor NUMERIC DEFAULT 1.0;

COMMENT ON COLUMN material_prices.overhead_factor IS '材料管理費係数 (ベンダー価格に掛ける係数)';
