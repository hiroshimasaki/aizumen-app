const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const sql = `
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
  storage_path text
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
    f.storage_path
  FROM drawing_tiles dt
  JOIN quotation_files f ON dt.file_id = f.id
  WHERE dt.tenant_id = p_tenant_id
    AND 1 - (dt.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
`;

async function applyFix() {
    console.log('Applying RPC fix to Supabase...');
    const { error } = await supabase.rpc('apply_sql_patch', { sql_query: sql }).catch(async (err) => {
        // apply_sql_patch がない場合は直接実行を試みる（プロジェクト設定による）
        // 通常のプロジェクトでは SQL Editor 権限が必要なため、管理用関数がない場合はエラーになる
        console.log('Direct RPC execution for SQL might be restricted. If this fails, please run the SQL manually in Supabase Dashboard.');
        return { error: err };
    });

    if (error) {
        console.error('Failed to apply SQL via RPC. Please use the Supabase Dashboard SQL Editor with the following content:', error);
        console.log('\n--- SQL START ---');
        console.log(sql);
        console.log('--- SQL END ---\n');
    } else {
        console.log('Successfully updated match_drawing_tiles function.');
    }
}

// 注意: プロジェクトに SQL 実行用の RPC がない場合、このスクリプトは失敗します。
// その場合はユーザーに SQL エディタでの実行を促します。
// 今回はまず Supabase CLI ではなく、より直接的な手段を検討します。
console.log('Note: Running raw SQL via REST API is usually disabled for security.');
console.log('Alternative: Using direct database connection if available, or providing the SQL for manual entry.');

applyFix();
