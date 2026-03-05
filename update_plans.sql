-- 古い制約を先に削除する
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_plan_check;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

-- データの更新
UPDATE tenants SET plan = 'lite' WHERE plan = 'small';
UPDATE tenants SET plan = 'plus' WHERE plan = 'medium';
UPDATE tenants SET plan = 'pro' WHERE plan = 'large';

UPDATE subscriptions SET plan = 'lite' WHERE plan = 'small';
UPDATE subscriptions SET plan = 'plus' WHERE plan = 'medium';
UPDATE subscriptions SET plan = 'pro' WHERE plan = 'large';

-- 新しい制約の追加とデフォルト値の変更
ALTER TABLE tenants ADD CONSTRAINT tenants_plan_check CHECK (plan IN ('lite', 'plus', 'pro'));
ALTER TABLE tenants ALTER COLUMN plan SET DEFAULT 'lite';

ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('lite', 'plus', 'pro'));
