-- =============================================
-- AiZumen SaaS - Supabase Storageバケット設定
-- =============================================

-- 添付ファイル用バケット（プライベート）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'quotation-files',
    'quotation-files',
    false,
    20971520, -- 20MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLSポリシー
-- テナントは自分のフォルダのみアクセス可能
CREATE POLICY "tenant_upload" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'quotation-files'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    );

CREATE POLICY "tenant_select" ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'quotation-files'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    );

CREATE POLICY "tenant_delete" ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'quotation-files'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    );
