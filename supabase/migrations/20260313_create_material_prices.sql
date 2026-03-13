-- 材料単価マスタテーブルの作成
CREATE TABLE IF NOT EXISTS material_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_name TEXT NOT NULL,
    material_type TEXT NOT NULL,
    shape TEXT NOT NULL,
    min_dim NUMERIC DEFAULT 0,
    max_dim NUMERIC DEFAULT 999999,
    base_price_type TEXT DEFAULT 'kg',
    unit_price NUMERIC NOT NULL,
    density NUMERIC NOT NULL,
    cutting_cost_factor NUMERIC DEFAULT 0, -- カラム追加
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 既存テーブルがある場合に備えてカラム追加を明示 (安全策)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='material_prices' AND column_name='cutting_cost_factor') THEN
        ALTER TABLE material_prices ADD COLUMN cutting_cost_factor NUMERIC DEFAULT 0;
    END IF;
END $$;

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_material_prices_tenant_id ON material_prices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_material_prices_lookup ON material_prices(tenant_id, material_type, shape, min_dim, max_dim) WHERE is_active = true;

-- 更新日時自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_update_material_prices_updated_at ON material_prices;
CREATE TRIGGER tr_update_material_prices_updated_at
    BEFORE UPDATE ON material_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- quotation_items テーブルへの計算メタデータ用カラム追加
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS material_metadata JSONB;

COMMENT ON TABLE material_prices IS '業者別の鋼材単価マスタ';
COMMENT ON COLUMN material_prices.min_dim IS '基準寸法（板厚や径）の最小値';
COMMENT ON COLUMN material_prices.max_dim IS '基準寸法（板厚や径）の最大値';
COMMENT ON COLUMN material_prices.density IS '材質ごとの比重';
COMMENT ON COLUMN material_prices.cutting_cost_factor IS '切断費用係数 (径や板厚に掛ける単価)';
COMMENT ON COLUMN quotation_items.material_metadata IS '材料費計算に使用した寸法や単価、重さの記録';
