-- quotation_files にページハッシュ用のカラムを追加
ALTER TABLE quotation_files ADD COLUMN IF NOT EXISTS page_hash TEXT;

-- ハッシュの類似度（ハミング距離に基づく）を計算する RPC 関数
-- 距離が 0 なら完全に同一。
CREATE OR REPLACE FUNCTION match_drawing_by_hash (
  p_query_hash TEXT,
  p_tenant_id UUID,
  p_threshold INTEGER DEFAULT 10
)
RETURNS TABLE (
  file_id UUID,
  original_name TEXT,
  storage_path TEXT,
  mime_type TEXT,
  hamming_distance INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- BIGINT や BIT 演算で高速化したいが、まずはシンプルな文字列比較（LEVENSHTEIN相当または直接）で開始
  -- 文字列（16進数等）のハッシュビット差を計算するロジック
  RETURN QUERY
  SELECT
    id as file_id,
    f.original_name,
    f.storage_path,
    f.mime_type,
    -- PostgreSQL 14+ なら bit_count で XOR 演算が可能
    -- 文字列ハッシュを BIT(64) に読み替えて XOR 計算を行う
    (bit_count(('x' || lpad(f.page_hash, 16, '0'))::bit(64) # ('x' || lpad(p_query_hash, 16, '0'))::bit(64))) as hamming_distance
  FROM quotation_files f
  WHERE f.tenant_id = p_tenant_id
    AND f.page_hash IS NOT NULL
    AND (bit_count(('x' || lpad(f.page_hash, 16, '0'))::bit(64) # ('x' || lpad(p_query_hash, 16, '0'))::bit(64))) <= p_threshold
  ORDER BY hamming_distance ASC;
END;
$$;
