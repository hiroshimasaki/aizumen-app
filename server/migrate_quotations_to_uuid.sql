-- migrate_quotations_to_uuid.sql
-- 見積番号(QYYMMDD-XXX)を主キーから外し、UUIDを新たな主キーとするマイグレーションスクリプト

BEGIN;

-- 1. UUID列の追加
ALTER TABLE quotations ADD COLUMN uuid UUID DEFAULT gen_random_uuid();
ALTER TABLE quotation_items ADD COLUMN quotation_uuid UUID;
ALTER TABLE quotation_files ADD COLUMN quotation_uuid UUID;
ALTER TABLE quotation_source_files ADD COLUMN quotation_uuid UUID;
ALTER TABLE quotation_history ADD COLUMN quotation_uuid UUID;

-- 2. 既存のIDに基づきUUIDを紐付け (tenant_id も条件に含め、安全に紐付け)
UPDATE quotation_items qi SET quotation_uuid = q.uuid FROM quotations q WHERE qi.quotation_id = q.id AND qi.tenant_id = q.tenant_id;
UPDATE quotation_files qf SET quotation_uuid = q.uuid FROM quotations q WHERE qf.quotation_id = q.id;
UPDATE quotation_source_files qsf SET quotation_uuid = q.uuid FROM quotations q WHERE qsf.quotation_id = q.id;
UPDATE quotation_history qh SET quotation_uuid = q.uuid FROM quotations q WHERE qh.quotation_id = q.id AND qh.tenant_id = q.tenant_id;

-- 外部参照の source_file_id にも対応する場合 (quotation_source_files)
-- source_file_id は quotation_files.id を指していますが、すでにファイルIDがUUIDであるなら変更不要。

-- 3. 古い主キーと外部キーの制約を削除
-- CASCADE を指定することで、関連する外部キー制約が自動的に削除されます。
ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_pkey CASCADE;

-- 4. 列名の変更と新しい主キーの設定
ALTER TABLE quotations RENAME COLUMN id TO display_id;
ALTER TABLE quotations RENAME COLUMN uuid TO id;

-- 新主キーの設定
ALTER TABLE quotations Add PRIMARY KEY (id);

-- 複合ユニーク制約の追加 (同じテナント内で display_id が重複しないようにする)
ALTER TABLE quotations ADD CONSTRAINT quotations_tenant_id_display_id_key UNIQUE (tenant_id, display_id);

-- 5. 関連テーブルの列名変更と外部キー再設定 (CASCADEを使い、依存するポリシー等も一度削除)
-- quotation_items
ALTER TABLE quotation_items DROP COLUMN quotation_id CASCADE;
ALTER TABLE quotation_items RENAME COLUMN quotation_uuid TO quotation_id;
ALTER TABLE quotation_items ADD CONSTRAINT quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES quotations (id) ON DELETE CASCADE;

-- quotation_files
ALTER TABLE quotation_files DROP COLUMN quotation_id CASCADE;
ALTER TABLE quotation_files RENAME COLUMN quotation_uuid TO quotation_id;
ALTER TABLE quotation_files ADD CONSTRAINT quotation_files_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES quotations (id) ON DELETE CASCADE;

-- quotation_source_files
ALTER TABLE quotation_source_files DROP COLUMN quotation_id CASCADE;
ALTER TABLE quotation_source_files RENAME COLUMN quotation_uuid TO quotation_id;
ALTER TABLE quotation_source_files ADD CONSTRAINT quotation_source_files_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES quotations (id) ON DELETE CASCADE;

-- quotation_history
ALTER TABLE quotation_history DROP COLUMN quotation_id CASCADE;
ALTER TABLE quotation_history RENAME COLUMN quotation_uuid TO quotation_id;
ALTER TABLE quotation_history ADD CONSTRAINT quotation_history_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES quotations (id) ON DELETE CASCADE;

-- ※注意: CASCADEによりRLSポリシーが削除された場合は、SQL Editor等でポリシーを再作成してください。
-- 例: CREATE POLICY "allow_authenticated" ON quotation_source_files FOR ALL TO authenticated USING (tenant_id = ((auth.jwt() -> 'app_metadata'::text) ->> 'tenant_id'::text));

COMMIT;
