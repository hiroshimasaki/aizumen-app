-- usersテーブルのrole制約を更新 (system_adminを追加)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('system_admin', 'admin', 'user', 'viewer'));

-- tenantsテーブルのplan制約を更新 ('free'を追加)
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_plan_check;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_plan_check CHECK (plan IN ('free', 'lite', 'plus', 'pro'));

-- subscriptionsテーブルのplan制約を更新
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('free', 'lite', 'plus', 'pro'));
