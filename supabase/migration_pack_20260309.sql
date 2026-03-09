-- ==========================================================
-- AiZumen Database Migration Pack (2026-03-09) - Idempotent Version
-- ----------------------------------------------------------
-- このスクリプトは、一部の変更がすでに適用されている場合でも
-- 安全に（エラーにならずに）実行できるように構成されています。
-- ==========================================================

BEGIN;

-- 1. 基盤拡張と管理機能
-- ----------------------------------------------------------

-- pgvector 拡張を有効化 (すでに存在すればスキップ)
CREATE EXTENSION IF NOT EXISTS vector;

-- プラットフォーム管理者テーブル
CREATE TABLE IF NOT EXISTS public.platform_admins (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       VARCHAR(255) NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform_admins_self_read" ON public.platform_admins;
CREATE POLICY "platform_admins_self_read" ON public.platform_admins FOR SELECT USING (auth.uid() = id);

-- メンテナンスモード設定
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins can manage system settings" ON public.system_settings;
CREATE POLICY "Platform admins can manage system settings" ON public.system_settings FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'platform_admin') WITH CHECK (auth.jwt() ->> 'role' = 'platform_admin');
DROP POLICY IF EXISTS "Authenticated users can read system settings" ON public.system_settings;
CREATE POLICY "Authenticated users can read system settings" ON public.system_settings FOR SELECT TO authenticated USING (true);

-- 初期データの安全な投入
INSERT INTO public.system_settings (key, value)
VALUES ('maintenance_mode', '{"enabled": false, "message": "", "started_at": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- 2. フォーラム機能
-- ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS forum_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_name VARCHAR(255) NOT NULL DEFAULT '',
    tenant_name VARCHAR(255) NOT NULL DEFAULT '',
    category VARCHAR(50) NOT NULL DEFAULT 'question' CHECK (category IN ('question', 'suggestion', 'bug', 'tips', 'other')),
    title VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT false,
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forum_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    user_name VARCHAR(255) NOT NULL DEFAULT '',
    tenant_name VARCHAR(255) NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forum_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES forum_posts(id) ON DELETE CASCADE,
    reply_id UUID REFERENCES forum_replies(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 3. 図面検索基盤
-- ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS drawing_tiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
    file_id UUID REFERENCES quotation_files(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    tile_index INTEGER,
    x INTEGER,
    y INTEGER,
    width INTEGER,
    height INTEGER,
    embedding vector(1280),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS drawing_tiles_embedding_idx ON drawing_tiles USING hnsw (embedding vector_cosine_ops);
ALTER TABLE drawing_tiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_drawing_tiles" ON drawing_tiles;
CREATE POLICY "tenant_isolation_drawing_tiles" ON drawing_tiles FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

-- 最新の類似検索 RPC 関数 (何度でも上書き定義可能)
CREATE OR REPLACE FUNCTION match_drawing_tiles (
  query_embedding vector(1280),
  match_threshold float,
  match_count int,
  p_tenant_id uuid
)
RETURNS TABLE (
  id uuid,
  quotation_id uuid,
  file_id uuid,
  tenant_id uuid,
  tile_index int,
  x int,
  y int,
  similarity float,
  storage_path text,
  mime_type text
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    dt.id, dt.quotation_id, dt.file_id, dt.tenant_id, dt.tile_index, dt.x, dt.y,
    1 - (dt.embedding <=> query_embedding) AS similarity,
    qf.storage_path, qf.mime_type
  FROM drawing_tiles dt
  JOIN quotation_files qf ON dt.file_id = qf.id
  WHERE dt.tenant_id = p_tenant_id
    AND 1 - (dt.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;


-- 4. カラムの存在チェックと追加 (冪等性の確保)
-- ----------------------------------------------------------

DO $$ 
BEGIN
    -- quotations テーブルに is_deleted カラムがない場合のみ追加
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotations' AND column_name='is_deleted') THEN
        ALTER TABLE quotations ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
        CREATE INDEX IF NOT EXISTS idx_quotations_is_deleted ON quotations(tenant_id, is_deleted);
    END IF;
END $$;

COMMIT;
