# AiZumen - データベース設計書

> **作成日**: 2026-03-01  
> **基盤**: Supabase PostgreSQL + Row Level Security

---

## ER図

```mermaid
erDiagram
    tenants ||--o{ users : "has"
    tenants ||--o| subscriptions : "has"
    tenants ||--o| ai_credits : "has"
    tenants ||--o| tenant_settings : "has"
    tenants ||--o{ companies : "has"
    tenants ||--o{ quotations : "has"

    users ||--o{ quotations : "creates"
    users ||--o{ quotation_history : "changes"
    users ||--o{ ai_credit_transactions : "uses"

    companies ||--o{ quotations : "belongs to"

    quotations ||--o{ quotation_items : "contains"
    quotations ||--o{ quotation_files : "has"
    quotations ||--o{ quotation_source_files : "references"
    quotations ||--o{ quotation_history : "tracks"
    quotations ||--o| quotations : "copied from"

    quotation_files ||--o{ quotation_source_files : "referenced by"

    tenants {
        uuid id PK
        varchar name
        varchar slug UK
        varchar plan
        jsonb settings
        timestamptz created_at
        timestamptz updated_at
    }

    users {
        uuid id PK
        uuid tenant_id FK
        varchar email
        varchar password_hash
        varchar name
        varchar role
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    subscriptions {
        uuid id PK
        uuid tenant_id FK
        varchar stripe_customer_id
        varchar stripe_subscription_id
        varchar plan
        varchar billing_cycle
        integer max_users
        varchar status
        timestamptz current_period_start
        timestamptz current_period_end
        timestamptz created_at
        timestamptz updated_at
    }

    ai_credits {
        uuid id PK
        uuid tenant_id FK
        integer balance
        integer monthly_quota
        timestamptz last_reset_at
        timestamptz created_at
        timestamptz updated_at
    }

    ai_credit_transactions {
        uuid id PK
        uuid tenant_id FK
        uuid user_id FK
        integer amount
        varchar type
        text description
        timestamptz created_at
    }

    tenant_settings {
        uuid id PK
        uuid tenant_id FK
        text ocr_prompt
        text scan_storage_path
        jsonb settings_json
        timestamptz updated_at
    }

    companies {
        uuid id PK
        uuid tenant_id FK
        varchar name
        jsonb contact_info
        timestamptz created_at
    }

    quotations {
        varchar id PK
        uuid tenant_id FK
        uuid company_id FK
        varchar company_name
        varchar contact_person
        text email_link
        text notes
        varchar order_number
        varchar construction_number
        varchar status
        varchar source_id FK
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    quotation_items {
        uuid id PK
        varchar quotation_id FK
        uuid tenant_id FK
        integer sort_order
        varchar name
        numeric quantity
        numeric processing_cost
        numeric material_cost
        numeric other_cost
        date response_date
        date due_date
        date delivery_date
        date scheduled_start_date
        numeric actual_hours
        numeric actual_processing_cost
        numeric actual_material_cost
        numeric actual_other_cost
        varchar actual_mode
    }

    quotation_files {
        uuid id PK
        varchar quotation_id FK
        uuid tenant_id FK
        text storage_path
        varchar original_name
        varchar file_hash
        bigint file_size
        varchar mime_type
        varchar file_type
        timestamptz created_at
    }

    quotation_source_files {
        uuid id PK
        varchar quotation_id FK
        uuid source_file_id FK
        varchar original_name
        text original_path
    }

    quotation_history {
        uuid id PK
        varchar quotation_id FK
        uuid tenant_id FK
        uuid changed_by FK
        varchar change_type
        jsonb changes
        timestamptz created_at
    }
```

---

## テーブル詳細

### tenants - テナント管理
企業単位の契約母体。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| name | VARCHAR(255) | NOT NULL | 企業名 |
| slug | VARCHAR(100) | UNIQUE, NOT NULL | URLスラグ |
| plan | VARCHAR(50) | DEFAULT 'small' | small/medium/large |
| settings | JSONB | DEFAULT '{}' | テナント固有設定 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

### users - ユーザー管理
Supabase Auth の `auth.users` と連携。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | Supabase Auth user IDと同一 |
| tenant_id | UUID | FK → tenants(id), NOT NULL | |
| email | VARCHAR(255) | NOT NULL | |
| name | VARCHAR(255) | NOT NULL | |
| role | VARCHAR(50) | DEFAULT 'user' | admin/user/viewer |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |
| | | UNIQUE(tenant_id, email) | |

> [!NOTE]
> パスワードハッシュはSupabase Auth側で管理するため、このテーブルには含めない。

### subscriptions - サブスクリプション
Stripeのサブスクリプション情報を同期。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants(id), NOT NULL | |
| stripe_customer_id | VARCHAR(255) | | Stripe顧客ID |
| stripe_subscription_id | VARCHAR(255) | | StripeサブスクリプションID |
| plan | VARCHAR(50) | NOT NULL | small/medium/large |
| billing_cycle | VARCHAR(20) | NOT NULL | monthly/yearly |
| max_users | INTEGER | NOT NULL | プランごとの上限 |
| status | VARCHAR(50) | DEFAULT 'active' | active/past_due/canceled/trialing |
| current_period_start | TIMESTAMPTZ | | 現在の請求期間開始 |
| current_period_end | TIMESTAMPTZ | | 現在の請求期間終了 |

### ai_credits - AIクレジット残高

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | |
| tenant_id | UUID | FK, UNIQUE | |
| balance | INTEGER | DEFAULT 0 | 現在の残高 |
| monthly_quota | INTEGER | DEFAULT 0 | 月間自動付与量 |
| last_reset_at | TIMESTAMPTZ | | 最終リセット日時 |

### ai_credit_transactions - クレジット履歴

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | |
| tenant_id | UUID | FK, NOT NULL | |
| user_id | UUID | FK → users(id) | |
| amount | INTEGER | NOT NULL | +購入 / -消費 |
| type | VARCHAR(50) | NOT NULL | usage/purchase/monthly_grant |
| description | TEXT | | 処理内容の説明 |

---

## RLSポリシー設計

全テナント別テーブルにRLSを有効化し、`auth.jwt() ->> 'tenant_id'` でフィルタリング。

```sql
-- 例: quotationsテーブル
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON quotations
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);
```

### RLS適用テーブル一覧
- `quotations`
- `quotation_items`
- `quotation_files`
- `quotation_source_files`
- `quotation_history`
- `companies`
- `ai_credits`
- `ai_credit_transactions`
- `tenant_settings`
- `users`（同一テナント内のみ参照可能）

---

## インデックス設計

```sql
-- 見積検索の高速化
CREATE INDEX idx_quotations_tenant ON quotations(tenant_id);
CREATE INDEX idx_quotations_status ON quotations(tenant_id, status);
CREATE INDEX idx_quotations_company ON quotations(tenant_id, company_name);
CREATE INDEX idx_quotations_order_number ON quotations(tenant_id, order_number);
CREATE INDEX idx_quotations_created ON quotations(tenant_id, created_at DESC);

-- 明細行
CREATE INDEX idx_items_quotation ON quotation_items(quotation_id);
CREATE INDEX idx_items_due_date ON quotation_items(tenant_id, due_date);
CREATE INDEX idx_items_delivery ON quotation_items(tenant_id, delivery_date);

-- ファイル
CREATE INDEX idx_files_quotation ON quotation_files(quotation_id);
CREATE INDEX idx_files_hash ON quotation_files(tenant_id, file_hash);

-- 履歴
CREATE INDEX idx_history_quotation ON quotation_history(quotation_id, created_at DESC);

-- クレジット履歴
CREATE INDEX idx_credit_tx_tenant ON ai_credit_transactions(tenant_id, created_at DESC);
```
