-- =============================================
-- AiZumen SaaS - 見積関連テーブル
-- =============================================

-- 取引先マスタ
CREATE TABLE companies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    contact_info JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_companies_tenant ON companies(tenant_id);

-- 見積テーブル（メイン）
CREATE TABLE quotations (
    id                  VARCHAR(20) PRIMARY KEY,
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id          UUID REFERENCES companies(id),
    company_name        VARCHAR(255) DEFAULT '',
    contact_person      VARCHAR(255) DEFAULT '',
    email_link          TEXT DEFAULT '',
    notes               TEXT DEFAULT '',
    order_number        VARCHAR(100) DEFAULT '',
    construction_number VARCHAR(100) DEFAULT '',
    status              VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'ordered', 'lost')),
    source_id           VARCHAR(20) REFERENCES quotations(id) ON DELETE SET NULL,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quotations_tenant ON quotations(tenant_id);
CREATE INDEX idx_quotations_status ON quotations(tenant_id, status);
CREATE INDEX idx_quotations_company ON quotations(tenant_id, company_name);
CREATE INDEX idx_quotations_order_number ON quotations(tenant_id, order_number);
CREATE INDEX idx_quotations_created ON quotations(tenant_id, created_at DESC);

-- 見積明細行
CREATE TABLE quotation_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id            VARCHAR(20) NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sort_order              INTEGER DEFAULT 0,
    name                    VARCHAR(500) DEFAULT '',
    quantity                NUMERIC(12,2) DEFAULT 1,
    processing_cost         NUMERIC(12,2) DEFAULT 0,
    material_cost           NUMERIC(12,2) DEFAULT 0,
    other_cost              NUMERIC(12,2) DEFAULT 0,
    response_date           DATE,
    due_date                DATE,
    delivery_date           DATE,
    scheduled_start_date    DATE,
    actual_hours            NUMERIC(8,2) DEFAULT 0,
    actual_processing_cost  NUMERIC(12,2) DEFAULT 0,
    actual_material_cost    NUMERIC(12,2) DEFAULT 0,
    actual_other_cost       NUMERIC(12,2) DEFAULT 0,
    actual_mode             VARCHAR(10) DEFAULT 'amount'
                            CHECK (actual_mode IN ('hours', 'amount'))
);

CREATE INDEX idx_items_quotation ON quotation_items(quotation_id);
CREATE INDEX idx_items_due_date ON quotation_items(tenant_id, due_date);
CREATE INDEX idx_items_delivery ON quotation_items(tenant_id, delivery_date);

-- 添付ファイル
CREATE TABLE quotation_files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id    VARCHAR(20) NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    storage_path    TEXT NOT NULL,
    original_name   VARCHAR(500) NOT NULL,
    file_hash       VARCHAR(64),
    file_size       BIGINT,
    mime_type       VARCHAR(100),
    file_type       VARCHAR(20) DEFAULT 'attachment'
                    CHECK (file_type IN ('attachment', 'po', 'drawing')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_files_quotation ON quotation_files(quotation_id);
CREATE INDEX idx_files_hash ON quotation_files(tenant_id, file_hash);

-- コピー元ファイル参照
CREATE TABLE quotation_source_files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id    VARCHAR(20) NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    source_file_id  UUID REFERENCES quotation_files(id) ON DELETE SET NULL,
    original_name   VARCHAR(500),
    original_path   TEXT
);

-- 変更履歴
CREATE TABLE quotation_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id    VARCHAR(20) NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    changed_by      UUID REFERENCES users(id),
    change_type     VARCHAR(50) NOT NULL,
    changes         JSONB NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_history_quotation ON quotation_history(quotation_id, created_at DESC);

-- =============================================
-- Row Level Security
-- =============================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_source_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_history ENABLE ROW LEVEL SECURITY;

-- テナント分離ポリシー
CREATE POLICY "tenant_isolation" ON companies
    FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID)
    WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

CREATE POLICY "tenant_isolation" ON quotations
    FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID)
    WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

CREATE POLICY "tenant_isolation" ON quotation_items
    FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID)
    WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

CREATE POLICY "tenant_isolation" ON quotation_files
    FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID)
    WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

-- quotation_source_files はtenant_idを持たないため、quotation_id経由でRLSを適用
-- quotation_files, quotations のRLSで間接的にテナント分離される
CREATE POLICY "allow_authenticated" ON quotation_source_files
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM quotations q
            WHERE q.id = quotation_source_files.quotation_id
            AND q.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID
        )
    );

CREATE POLICY "tenant_isolation" ON quotation_history
    FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID)
    WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
