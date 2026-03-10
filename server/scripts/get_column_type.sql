-- get_column_type.sql
-- 既に psql が使えないため、 migration で追加するか RPC で実行する
CREATE OR REPLACE FUNCTION get_table_schema(table_name_input text)
RETURNS TABLE (column_name text, data_type text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cols.column_name::text, 
        cols.data_type::text
    FROM 
        information_schema.columns cols
    WHERE 
        cols.table_name = table_name_input
    ORDER BY 
        cols.ordinal_position;
END;
$$;
