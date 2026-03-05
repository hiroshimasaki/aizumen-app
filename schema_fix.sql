-- Phase 3 & 4 で追加したカラムをデータベースに適用するスクリプト
-- SupabaseのSQL Editorで実行してください。

-- 1. AIクレジットの購入済み残高管理用
ALTER TABLE ai_credits ADD COLUMN IF NOT EXISTS purchased_balance INTEGER DEFAULT 0;

-- 2. テナント（会社）の詳細情報追加
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS website VARCHAR(255);

-- 3. 案件の着工日追加（ガントチャート用）
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS work_start_date DATE;
