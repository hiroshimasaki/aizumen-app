-- tenants テーブルにストレージ使用量を記録するカラムを追加
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS storage_usage_bytes BIGINT DEFAULT 0;

-- 既存データの集計（初期化）
-- 注意: この時点では quotation_files 以外（サムネイルやバックアップ）はまだ集計されませんが、
-- アプリケーション側の storageService.js の初回実行時に正しく更新されることを前提とします。
UPDATE tenants t
SET storage_usage_bytes = (
    SELECT COALESCE(SUM(file_size), 0)
    FROM quotation_files f
    WHERE f.tenant_id = t.id
);
