-- quotationsテーブルに確認済みフラグを追加
ALTER TABLE quotations ADD COLUMN is_verified BOOLEAN DEFAULT true;

-- 既存のデータをすべて確認済みとしてマーク（必要に応じて）
UPDATE quotations SET is_verified = true;

-- 今後のデフォルトはfalseにしたいが、通常の新規登録との兼ね合いで
-- API側で制御するのが安全。
