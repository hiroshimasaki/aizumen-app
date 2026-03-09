-- 既存の関数を削除（戻り値の型変更を伴うため DROP が必要）
DROP FUNCTION IF EXISTS match_drawing_tiles(vector, float, int, uuid);

-- ベクトル類似度検索用の RPC 関数を再定義（storage_path と mime_type を取得するように修正）
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
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dt.id,
    dt.quotation_id,
    dt.file_id,
    dt.tenant_id,
    dt.tile_index,
    dt.x,
    dt.y,
    1 - (dt.embedding <=> query_embedding) AS similarity,
    qf.storage_path,
    qf.mime_type
  FROM drawing_tiles dt
  JOIN quotation_files qf ON dt.file_id = qf.id
  WHERE dt.tenant_id = p_tenant_id
    AND 1 - (dt.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
