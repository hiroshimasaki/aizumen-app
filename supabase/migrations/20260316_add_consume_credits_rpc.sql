-- AIクレジットを安全に消費するための関数
-- 競合状態（Race Condition）を防ぐため、アトミックに更新を行います。
CREATE OR REPLACE FUNCTION consume_ai_credits_atomic(
  p_tenant_id UUID,
  p_amount INTEGER,
  p_user_id UUID,
  p_description TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_current_purchased INTEGER;
  v_new_balance INTEGER;
  v_new_purchased INTEGER;
  v_regular_balance INTEGER;
  v_remainder INTEGER;
BEGIN
  -- 1. 現在の残高をロックしつつ取得 (FOR UPDATE)
  SELECT balance, purchased_balance INTO v_current_balance, v_current_purchased
  FROM ai_credits
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  -- データがない場合は例外
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AIクレジット情報が見つかりません (tenant_id: %)', p_tenant_id;
  END IF;

  -- 2. 残高不足チェック
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'クレジットが不足しています。必要: %, 残高: %', p_amount, v_current_balance;
  END IF;

  -- 3. 消費計算 (通常枠 -> 追加購入枠の順)
  v_regular_balance := v_current_balance - v_current_purchased;
  IF v_regular_balance < 0 THEN v_regular_balance := 0; END IF;

  IF v_regular_balance >= p_amount THEN
    -- 通常枠だけで足りる場合
    v_new_balance := v_current_balance - p_amount;
    v_new_purchased := v_current_purchased;
  ELSE
    -- 通常枠を使い切り、不足分を課金枠から引く
    v_remainder := p_amount - v_regular_balance;
    v_new_purchased := v_current_purchased - v_remainder;
    v_new_balance := v_current_balance - p_amount;
  END IF;

  -- 4. クレジット更新
  UPDATE ai_credits
  SET 
    balance = v_new_balance,
    purchased_balance = v_new_purchased,
    updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  -- 5. トランザクション履歴挿入
  INSERT INTO ai_credit_transactions (
    tenant_id,
    user_id,
    amount,
    type,
    description
  ) VALUES (
    p_tenant_id,
    p_user_id,
    -p_amount,
    'usage',
    p_description
  );

  RETURN jsonb_build_object(
    'balance', v_new_balance,
    'purchased_balance', v_new_purchased
  );
END;
$$;
