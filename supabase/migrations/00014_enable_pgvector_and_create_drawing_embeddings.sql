-- pgvector 拡張を有効化（ベクトル検索を可能にする）
CREATE EXTENSION IF NOT EXISTS vector;

-- テーブルのリセット（開発・初期導入フェーズのため、整合性確保を優先して削除後に再作成）
DROP TABLE IF EXISTS drawing_tiles CASCADE;

-- 図面のタイル分割データおよび特徴量ベクトルを保存するテーブル
CREATE TABLE drawing_tiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
    file_id UUID REFERENCES quotation_files(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    tile_index INTEGER,              -- タイルの連番
    x INTEGER,                       -- 元画像内のX座標
    y INTEGER,                       -- 元画像内のY座標
    width INTEGER,                   -- タイルの幅
    height INTEGER,                  -- タイルの高さ
    embedding vector(1280),          -- 特徴量ベクトル（1280次元：MobileNetV2）
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成（コサイン類似度検索を高速化する HNSW インデックス）
-- 注: リストの規模に応じて後ほど再構築・調整が必要になる場合があります
CREATE INDEX IF NOT EXISTS drawing_tiles_embedding_idx ON drawing_tiles 
USING hnsw (embedding vector_cosine_ops);

-- RLS (Row Level Security) の設定
ALTER TABLE drawing_tiles ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーがあれば一旦削除（再実行時のエラー防止のため）
DROP POLICY IF EXISTS "tenant_isolation_drawing_tiles" ON drawing_tiles;

CREATE POLICY "tenant_isolation_drawing_tiles" ON drawing_tiles
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

-- クエリの高速化のための一般的なインデックス
CREATE INDEX IF NOT EXISTS idx_drawing_tiles_quotation ON drawing_tiles(quotation_id);
CREATE INDEX IF NOT EXISTS idx_drawing_tiles_file ON drawing_tiles(file_id);
CREATE INDEX IF NOT EXISTS idx_drawing_tiles_tenant ON drawing_tiles(tenant_id);

-- ベクトル類似度検索用の RPC 関数
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
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    drawing_tiles.id,
    drawing_tiles.quotation_id,
    drawing_tiles.file_id,
    drawing_tiles.tenant_id,
    drawing_tiles.tile_index,
    drawing_tiles.x,
    drawing_tiles.y,
    1 - (drawing_tiles.embedding <=> query_embedding) AS similarity
  FROM drawing_tiles
  WHERE drawing_tiles.tenant_id = p_tenant_id
    AND 1 - (drawing_tiles.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
