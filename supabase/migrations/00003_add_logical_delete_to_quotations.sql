-- quotations テーブルに論理削除フラグを追加
ALTER TABLE quotations ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;

-- 検索パフォーマンス向上のためのインデックス作成
CREATE INDEX idx_quotations_is_deleted ON quotations(tenant_id, is_deleted);

-- 既存の履歴に削除・復元の型を追加するためのコメント（列挙型ではないのでチェック制約の更新が必要な場合）
-- 現状の quotation_history.change_type は特に制約がないため、そのまま 'deleted', 'restored' を使用可能
