# AiZumen データベーススキーマ統合資料 (NotebookLM用)

このドキュメントは、NotebookLMへのアップロード用に、`.sql` 形式のマイグレーションファイルを Markdown 形式に統合したものです。

---

## 1. 基盤：テナント・ユーザー・認証 (00001)

```sql
-- テナント管理
CREATE TABLE tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    plan                    VARCHAR(50) NOT NULL
                            CHECK (plan IN ('lite', 'standard', 'pro')),
    settings    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ユーザー管理
CREATE TABLE users (
    id          UUID PRIMARY KEY, -- Supabase Auth user ID
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email       VARCHAR(255) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    role        VARCHAR(50) DEFAULT 'user'
                CHECK (role IN ('admin', 'user', 'viewer')),
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

-- サブスクリプション管理
CREATE TABLE subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    stripe_customer_id      VARCHAR(255),
    stripe_subscription_id  VARCHAR(255),
    plan                    VARCHAR(50) NOT NULL,
    status                  VARCHAR(50) DEFAULT 'active',
    current_period_end      TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 2. 業務：見積・明細・ファイル (00002)

```sql
-- 見積テーブル（メイン）
CREATE TABLE quotations (
    id                  VARCHAR(20) PRIMARY KEY,
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_name        VARCHAR(255) DEFAULT '',
    contact_person      VARCHAR(255) DEFAULT '',
    notes               TEXT DEFAULT '',
    order_number        VARCHAR(100) DEFAULT '',
    construction_number VARCHAR(100) DEFAULT '',
    status              VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'ordered', 'lost')),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 見積明細行
CREATE TABLE quotation_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id            VARCHAR(20) NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                    VARCHAR(500) DEFAULT '',
    quantity                NUMERIC(12,2) DEFAULT 1,
    processing_cost         NUMERIC(12,2) DEFAULT 0,
    material_cost           NUMERIC(12,2) DEFAULT 0,
    due_date                DATE,
    delivery_date           DATE
);

-- 添付ファイル
CREATE TABLE quotation_files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id    VARCHAR(20) NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    storage_path    TEXT NOT NULL,
    original_name   VARCHAR(500) NOT NULL,
    file_type       VARCHAR(20) DEFAULT 'attachment'
                    CHECK (file_type IN ('attachment', 'po', 'drawing')),
    page_hash       VARCHAR(64), -- pHash 用のページ全体ハッシュ
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. AI検索：ベクトル保存 (00014)

```sql
-- 図面のタイル分割データおよび特徴量ベクトル
CREATE TABLE drawing_tiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
    file_id UUID REFERENCES quotation_files(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    tile_index INTEGER,              -- タイルの連番
    x REAL,                         -- 切り出し開始X (正規化座標 0.0-1.0)
    y REAL,                         -- 切り出し開始Y (正規化座標 0.0-1.0)
    width REAL,                     -- 切り出し幅 (正規化座標)
    height REAL,                    -- 切り出し高さ (正規化座標)
    embedding vector(1280),          -- 特徴量ベクトル
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. コミュニティ：フォーラム (00010)

```sql
-- フォーラム投稿
CREATE TABLE forum_posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    user_name   VARCHAR(255) NOT NULL DEFAULT '',
    category    VARCHAR(50) NOT NULL DEFAULT 'question',
    title       VARCHAR(500) NOT NULL,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

---

## 5. 決済・クレジット：Stripe・AIクレジット (00020)

```sql
-- AIクレジット残高管理
CREATE TABLE ai_credits (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    balance             INTEGER DEFAULT 0,          -- 現在の合計残高
    monthly_quota       INTEGER DEFAULT 0,          -- 月間プラン枠
    purchased_balance   INTEGER DEFAULT 0,          -- 購入済み残高（繰り越し対象）
    last_reset_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- クレジット利用・付与履歴
CREATE TABLE ai_credit_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    amount          INTEGER NOT NULL,           -- 増減量
    type            VARCHAR(50) NOT NULL,       -- 'usage', 'purchase', 'monthly_grant', 'plan_change'
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```
```
