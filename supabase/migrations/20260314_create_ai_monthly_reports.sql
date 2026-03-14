-- AI月次総評テーブルの追加
CREATE TABLE IF NOT EXISTS ai_monthly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    target_month VARCHAR(7) NOT NULL, -- YYYY-MM
    content TEXT NOT NULL,
    metrics_summary JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, target_month)
);

-- インデックスの追加
CREATE INDEX IF NOT EXISTS idx_ai_monthly_reports_tenant_month ON ai_monthly_reports(tenant_id, target_month);
