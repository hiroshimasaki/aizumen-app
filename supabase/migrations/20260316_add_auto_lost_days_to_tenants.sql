-- Migration: add_auto_lost_days_to_tenants
-- 案件の自動失注までの日数を保持するカラムを tenants テーブルに追加します。
-- また、既存のコードで参照されている hourly_rate カラムの存在も保証します。

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS hourly_rate INTEGER DEFAULT 8000;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS auto_lost_days INTEGER DEFAULT 0;

COMMENT ON COLUMN public.tenants.hourly_rate IS '実績工数から加工費を算出する際の基準価格 (円/時間)';
COMMENT ON COLUMN public.tenants.auto_lost_days IS '見積回答日から自動失注扱いにするまでの日数 (0で無効)';
