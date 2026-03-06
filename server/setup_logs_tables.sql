-- 1. システムエラーログ
CREATE TABLE IF NOT EXISTS public.system_error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    source TEXT NOT NULL, -- 'server' or 'client'
    level TEXT NOT NULL, -- 'error', 'warn', 'fatal'
    message TEXT NOT NULL,
    stack TEXT,
    path TEXT,
    method TEXT,
    browser_info JSONB
);

-- 2. アクセスログ
CREATE TABLE IF NOT EXISTS public.system_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    path TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    ip TEXT
);

-- 3. 監査ログ
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'DELETE_QUOTATION', 'CREATE_USER', etc.
    entity_type TEXT NOT NULL, -- 'quotation', 'user', 'settings', etc.
    entity_id TEXT,
    description TEXT,
    metadata JSONB
);

-- インデックスの作成（検索パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_error_logs_tenant ON public.system_error_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON public.system_error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_tenant ON public.system_access_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_created ON public.system_access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- RLS設定
ALTER TABLE public.system_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- スーパー管理者用ポリシー
CREATE POLICY "Super Admins can do everything on error logs" ON public.system_error_logs
    FOR ALL USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin');

CREATE POLICY "Super Admins can do everything on access logs" ON public.system_access_logs
    FOR ALL USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin');

CREATE POLICY "Super Admins can do everything on audit logs" ON public.audit_logs
    FOR ALL USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin');
