# AiZumen（AI図面） - SaaS版 要件定義書

> **プロジェクト名**: AiZumen  
> **作成日**: 2026-03-01  
> **バージョン**: 1.0  
> **ステータス**: ドラフト

---

## 1. プロジェクト概要

### 1.1 背景
正木鉄工で社内利用している見積・受注管理ツール（quotation-tool）を、マルチテナント対応のSaaS製品として再構築する。現在のシステムはJSONファイルベースの単一ユーザー・単一テナント設計であり、SaaS化にあたりデータベース・認証・ファイルストレージ・テナント分離等の根本的な改修が必要。

### 1.2 目的
- 製造業向けの見積・受注管理SaaSとして一般企業に提供
- AI（OCR）による注文書自動読取機能を差別化ポイントとする
- マルチテナント対応によりデータの完全分離を実現
- 会社単位の契約・ボリュームライセンスでの利用者管理

### 1.3 対象ユーザー
- **親アカウント（管理者）**: 企業の契約者。ライセンス管理・ユーザー払い出し・設定管理を行う
- **子アカウント（一般ユーザー）**: 親アカウントにより払い出されたユーザー。見積・受注業務を行う

---

## 2. システムアーキテクチャ

### 2.1 技術スタック

| レイヤー | 技術 | 備考 |
|---------|------|------|
| **フロントエンド** | React 19 + Vite 7 + TailwindCSS 4 | 既存FEを流用・拡張 |
| **バックエンド** | Node.js + Express 5 | Controller/Service層に分割 |
| **BaaS** | Supabase (フルスタック) | 下記参照 |
| **データベース** | Supabase PostgreSQL + RLS | マルチテナント分離 |
| **認証** | Supabase Auth | メール/パスワード認証 |
| **ファイルストレージ** | Supabase Storage | テナント別バケット |
| **AI/OCR** | Google Gemini 2.0 Flash / pgvector | 注文書OCR、類似図面検索（ベクトル化）、価格推定 |
| **決済** | Stripe | Lite / Plus / Pro プラン + 従量課金（AIクレジット） |
| **ホスティング** | Railway (API / Workers), Vercel (Front-end) | 本番ドメイン: aizumen.com |

### 2.2 Supabase利用範囲

Supabaseをフルスタックで活用する：

| 機能 | 利用内容 |
|------|---------|
| **PostgreSQL** | 全アプリケーションデータの格納 |
| **Row Level Security** | テナント間のデータ完全分離 |
| **Supabase Auth** | ユーザー認証・セッション管理 |
| **Supabase Storage** | 添付ファイル（PDF・画像）の保存 |
| **Supabase Edge Functions** | Webhook処理等（必要に応じて） |

### 2.3 デプロイ構成（推奨）

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│   Vercel     │    │   Railway    │    │   Supabase   │
│  (フロントエンド)│───▶│  (APIサーバー) │───▶│  (DB/Auth/   │
│  React SPA   │    │  Express API │    │   Storage)   │
└─────────────┘    └──────────────┘    └──────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │   Stripe     │
                   │  (決済処理)   │
                   └──────────────┘
```

**選定理由**:
- **Vercel**: React SPAのホスティングに最適。無料プランあり。CDN配信
- **Railway**: Node.js APIサーバーの簡単デプロイ。Dockerfileなしで起動可能
- **Supabase**: DB/認証/ストレージを一括管理。無料プランでプロトタイプ可能

> [!NOTE]
> ドメインは別途取得が必要。Vercel/Railwayとも独自ドメイン設定が可能。

---

## 3. 機能要件

### 3.1 既存機能（SaaS版に引き継ぎ）

| # | 機能 | SaaS化時の変更点 |
|---|------|----------------|
| 1 | 見積登録/編集 | DB(PostgreSQL)に永続化。テナント分離 |
| 2 | OCR自動登録 | Gemini API。テナント別プロンプト設定。AIクレジット消費 |
| 3 | スキャナプール | ブラウザD&D複数ファイルアップロードに変更（§3.3） |
| 4 | PDFページ編集 | そのまま流用 |
| 5 | 注文書/図面分割 | そのまま流用 |
| 6 | 見積リスト表示 | DB検索に変更。パフォーマンス向上 |
| 7 | ステータス管理 | そのまま流用 |
| 8 | 納品日管理 | そのまま流用 |
| 9 | 実績入力 | そのまま流用 |
| 10 | 見積コピー | そのまま流用 |
| 11 | 変更履歴自動記録 | quotation_historyテーブルに分離 |
| 12 | 重複チェック | DB側でハッシュ照合 |
| 13 | ガントチャート | そのまま流用 |
| 14 | ダッシュボード | そのまま流用 |
| 15 | 見積印刷 | そのまま流用 |
| 16 | 類似図面検索 | pgvectorによるベクトル検索。Geminiによるリランキング |
| 17 | スマート見積（価格推定） | 過去の類似図面からの価格自動算出。AIクレジット消費 |
| 18 | バックアップ/復元 | DB自動バックアップ（Supabase PITR管理） |
| 19 | 会社マスタ | DB管理。テナント分離（Supabase RLS） |
| 20 | メンテナンスモード | 管理者によるシステム一時停止・バイパスアクセス |

### 3.2 新規機能（SaaS化に伴う追加）

#### 3.2.1 認証・ユーザー管理

| 機能 | 説明 |
|------|------|
| サインアップ | 企業（テナント）登録 + 最初の管理者ユーザー作成 |
| ログイン/ログアウト | Supabase Auth によるメール/パスワード認証 |
| パスワードリセット | メールベースのリセットフロー |
| ユーザー招待 | 親アカウントからの招待メール送信 |
| ユーザー管理 | 親アカウントによる子アカウントのCRUD |
| ロール管理 | admin（管理者）/ user（一般）/ viewer（閲覧のみ） |

#### 3.2.2 テナント管理

| 機能 | 説明 |
|------|------|
| テナント作成 | 企業登録時に自動作成 |
| テナント設定 | 企業情報・設定のカスタマイズ |
| データ分離 | RLSによるテナント間の完全なデータ分離 |

#### 3.2.3 サブスクリプション・課金

| 機能 | 説明 |
|------|------|
| プラン選択 | 3段階プラン（§4参照） |
| 月額 | 年額プランはなし |
| Stripe連携 | サブスクリプション管理・決済処理 |
| AIクレジット購入 | 追加クレジットの従量購入 |
| 請求履歴 | 過去の請求・支払い一覧 |
| ライセンス管理 | 利用中ユーザー数の表示・制限 |

#### 3.2.4 テナント設定（ユーザーセッティング）

| 設定項目 | 説明 | 対象ロール |
|---------|------|-----------|
| AI解析プロンプト | Gemini APIに送信するOCR用プロンプトのカスタマイズ | admin |
| スキャンデータ保存先 | アップロードファイルの保存バケット設定 | admin |

### 3.3 スキャナプール（ファイルアップロード方式）

SaaS版では、ローカルネットワークスキャナからのポーリングを廃止し、**ブラウザ上でのドラッグ&ドロップによる複数ファイル一括アップロード**に変更する。

**仕様**:
- ブラウザ上にドロップゾーンを設置
- 複数PDF/画像ファイルの同時ドラッグ&ドロップ対応
- アップロード進捗表示（プログレスバー）
- アップロード後にプレビュー表示
- アップロード後のOCR処理はそのまま流用

**ファイルサイズ対策**:
- 1ファイルあたりの上限: **20MB**（スキャンPDFは通常1〜5MB）
- 1回のアップロード上限: **10ファイル**
- 合計サイズ上限: **100MB/回**
- サーバー側でファイルサイズ検証
- Supabase Storageのチャンクアップロード（大容量時）

> [!NOTE]
> 通常のスキャンPDFは1〜5MB程度のため、10ファイル同時アップロードでも50MB以下に収まる。帯域やストレージの肥大化リスクは低い。

---

## 4. 料金プラン

### 4.1 サブスクリプションプラン

| プラン | 月額 | ユーザー数 | AI解析回数/月 |
|--------|------|-----------|-------------|
| **7日間 無料体験** | ¥0 | 1名 | 10回 |
| **Lite** | ¥10,000 | 2名 | 100回 |
| **Standard** | ¥30,000 | 10名 | 500回 |
| **Pro** | ¥50,000 | 20名 | 1,000回 |

### 4.2 AIクレジット

| 項目 | 内容 |
|------|------|
| 初期付与 | プランごとに月間クレジットを付与（要設計） |
| 消費タイミング | OCR自動登録、スマート見積など、AI機能利用時 |
| 枯渇時 | AI機能が制限される（手動入力は引き続き可能） |
| 追加購入 | Stripeによるワンタイム決済で追加クレジット購入可 |
| クレジットリセット | 月初に月間クレジットをリセット（繰越なし） |

### 4.3 決済方式

| 項目 | 内容 |
|------|------|
| 決済プロバイダ | **Stripe** |
| サブスクリプション | Stripe Subscriptions（月額/年額） |
| AIクレジット追加 | Stripe Checkout（ワンタイム） |
| Webhook | Stripe Webhook → APIサーバー → DB更新 |
| 通貨 | JPY（日本円） |

**Stripe選定理由**: 日本国内での実績が豊富、決済手数料が業界標準（3.6%）、開発者向けドキュメントが充実

---

## 5. データベース設計

### 5.1 テーブル一覧

| テーブル | 説明 |
|---------|------|
| `tenants` | テナント（契約企業）管理 |
| `users` | ユーザー管理（Supabase Authと連携） |
| `subscriptions` | サブスクリプション管理 |
| `ai_credits` | AIクレジット残高・履歴 |
| `companies` | 取引先マスタ（テナント別） |
| `quotations` | 見積データ（メイン） |
| `quotation_items` | 見積明細行 |
| `quotation_files` | 添付ファイル管理 |
| `quotation_source_files` | コピー元ファイル参照 |
| `quotation_history` | 変更履歴 |
| `tenant_settings` | テナント別設定 |

### 5.2 スキーマ詳細

`quotation_architecture_analysis.md` のセクション4に記載のスキーマをベースとし、以下を追加：

```sql
-- サブスクリプション管理
CREATE TABLE subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    stripe_customer_id    VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    plan            VARCHAR(50) NOT NULL,           -- small|medium|large
    billing_cycle   VARCHAR(20) NOT NULL,           -- monthly|yearly
    max_users       INTEGER NOT NULL,               -- プランごとの上限
    status          VARCHAR(50) DEFAULT 'active',   -- active|past_due|canceled
    current_period_start TIMESTAMPTZ,
    current_period_end   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- AIクレジット管理
CREATE TABLE ai_credits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    balance         INTEGER NOT NULL DEFAULT 0,     -- 残高
    monthly_quota   INTEGER NOT NULL DEFAULT 0,     -- 月間付与量
    last_reset_at   TIMESTAMPTZ,                    -- 最終リセット日時
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- AIクレジット使用履歴
CREATE TABLE ai_credit_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    user_id         UUID REFERENCES users(id),
    amount          INTEGER NOT NULL,               -- 増減量（+購入, -消費）
    type            VARCHAR(50) NOT NULL,           -- usage|purchase|monthly_grant
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- テナント設定
CREATE TABLE tenant_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) UNIQUE,
    ocr_prompt      TEXT,                           -- AI解析カスタムプロンプト
    scan_storage_path TEXT,                         -- スキャンデータ保存パス
    settings_json   JSONB DEFAULT '{}',             -- その他拡張設定
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.3 Row Level Security (RLS)

全テナント別テーブルにRLSを適用し、テナント間のデータ完全分離を保証する。Supabase AuthのJWTトークンに含まれるテナントIDを使用して認可を行う。

---

## 6. APIエンドポイント設計

### 6.1 認証API

| Method | Path | 説明 |
|--------|------|------|
| `POST` | `/api/auth/signup` | テナント + 管理者アカウント作成 |
| `POST` | `/api/auth/login` | ログイン |
| `POST` | `/api/auth/logout` | ログアウト |
| `POST` | `/api/auth/reset-password` | パスワードリセット要求 |
| `PUT` | `/api/auth/update-password` | パスワード更新 |

### 6.2 ユーザー管理API（admin専用）

| Method | Path | 説明 |
|--------|------|------|
| `GET` | `/api/users` | テナント内ユーザー一覧 |
| `POST` | `/api/users/invite` | ユーザー招待 |
| `PUT` | `/api/users/:id` | ユーザー情報更新 |
| `DELETE` | `/api/users/:id` | ユーザー無効化 |

### 6.3 見積API（既存を拡張）

| Method | Path | 説明 |
|--------|------|------|
| `GET` | `/api/quotations` | 見積一覧（ページネーション・フィルタ対応） |
| `GET` | `/api/quotations/:id` | 見積詳細 |
| `POST` | `/api/quotations` | 見積新規作成 |
| `PUT` | `/api/quotations/:id` | 見積更新 |
| `DELETE` | `/api/quotations/:id` | 見積削除 |
| `POST` | `/api/quotations/batch-delivery` | 一括納品処理 |

### 6.4 ファイルAPI

| Method | Path | 説明 |
|--------|------|------|
| `POST` | `/api/files/upload` | ファイルアップロード（複数対応） |
| `GET` | `/api/files/:id` | ファイルダウンロード |
| `DELETE` | `/api/files/:id` | ファイル削除 |
| `POST` | `/api/files/:id/reorder-pages` | PDFページ並替 |

### 6.5 OCR API

| Method | Path | 説明 |
|--------|------|------|
| `POST` | `/api/ocr/analyze` | OCR解析（AIクレジット消費） |
| `POST` | `/api/ocr/bulk-register` | 一括OCR登録（AIクレジット消費） |

### 6.6 設定API

| Method | Path | 説明 |
|--------|------|------|
| `GET` | `/api/settings` | テナント設定取得 |
| `PUT` | `/api/settings` | テナント設定更新 |

### 6.7 サブスクリプションAPI

| Method | Path | 説明 |
|--------|------|------|
| `GET` | `/api/subscription` | 現在のプラン情報 |
| `POST` | `/api/subscription/checkout` | Stripeチェックアウトセッション作成 |
| `POST` | `/api/subscription/portal` | Stripeカスタマーポータル |
| `GET` | `/api/credits` | AIクレジット残高 |
| `POST` | `/api/credits/purchase` | AIクレジット追加購入 |
| `POST` | `/api/webhooks/stripe` | Stripe Webhook受信 |

### 6.8 会社マスタAPI

| Method | Path | 説明 |
|--------|------|------|
| `GET` | `/api/companies` | 取引先一覧 |
| `POST` | `/api/companies` | 取引先追加 |
| `PUT` | `/api/companies/:id` | 取引先更新 |

---

## 7. セキュリティ要件

| 要件 | 実装方針 |
|------|---------|
| 認証 | Supabase Auth（JWT） |
| 認可 | RLS + APIミドルウェアでのロールチェック |
| テナント分離 | PostgreSQL RLS（全テーブル） |
| 通信暗号化 | HTTPS必須 |
| ファイルアクセス | Supabase StorageのRLS + 署名付きURL |
| パスワード | bcryptハッシュ化（Supabase Auth内部処理） |
| CORS | 許可オリジンの制限 |
| レート制限 | API呼び出し回数制限（特にOCR API） |

---

## 8. 非機能要件

| 要件 | 目標値 |
|------|--------|
| レスポンスタイム | API応答 500ms以内（95パーセンタイル） |
| ファイルアップロード | 1ファイル20MBまで、10ファイル同時、100MB/回 |
| 可用性 | 99.5%（Supabase/Railway SLA準拠） |
| データバックアップ | Supabase自動バックアップ（日次） |
| 同時接続 | テナントあたり50ユーザーまで |

---

## 9. データ移行

### 9.1 移行対象
正木鉄工の既存データ（quotations.json: 184KB, 5244行）を最初のテナントとして移行。

### 9.2 移行内容

| 対象 | 移行先 | 備考 |
|------|--------|------|
| quotations.json | quotations + quotation_items + quotation_files テーブル | ID体系・日付・数値型の変換 |
| companies.json | companies テーブル | テナントID付与 |
| uploads/ | Supabase Storage | パス変換 |
| scanned_pool/ | 不要（SaaS版はD&D方式） | |

### 9.3 移行スクリプト
`scripts/migrate-json-to-supabase.js` として実装。

---

## 10. プロジェクト構造

```
AiZumen/
├── docs/                           # ドキュメント
│   ├── requirements.md             # 本要件定義書
│   └── quotation_architecture_analysis.md
├── client/                         # フロントエンド
│   ├── src/
│   │   ├── components/             # UIコンポーネント
│   │   │   ├── auth/               # 認証関連
│   │   │   ├── admin/              # 管理者画面
│   │   │   ├── quotation/          # 見積関連（既存流用）
│   │   │   ├── settings/           # 設定画面
│   │   │   └── subscription/       # 課金関連
│   │   ├── hooks/                  # カスタムフック
│   │   ├── contexts/               # React Context
│   │   ├── lib/                    # ユーティリティ
│   │   │   └── supabase.js         # Supabaseクライアント
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── server/                         # バックエンドAPI
│   ├── src/
│   │   ├── index.js                # エントリポイント
│   │   ├── config/
│   │   │   ├── supabase.js         # Supabase Admin設定
│   │   │   └── stripe.js           # Stripe設定
│   │   ├── middleware/
│   │   │   ├── auth.js             # 認証ミドルウェア
│   │   │   ├── tenant.js           # テナント識別
│   │   │   ├── credits.js          # AIクレジット確認
│   │   │   └── errorHandler.js     # エラーハンドリング
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── quotations.js
│   │   │   ├── companies.js
│   │   │   ├── files.js
│   │   │   ├── ocr.js
│   │   │   ├── settings.js
│   │   │   ├── subscription.js
│   │   │   └── users.js
│   │   ├── services/
│   │   │   ├── quotationService.js
│   │   │   ├── fileService.js
│   │   │   ├── ocrService.js
│   │   │   ├── historyService.js
│   │   │   ├── creditService.js
│   │   │   └── stripeService.js
│   │   └── utils/
│   │       ├── parsePrice.js
│   │       └── idGenerator.js
│   └── package.json
├── prisma/                         # DBスキーマ（Supabaseと併用）
│   └── schema.prisma
├── scripts/                        # ツール
│   └── migrate-json-to-supabase.js
├── supabase/                       # Supabase設定
│   ├── config.toml
│   └── migrations/                 # SQLマイグレーション
└── package.json
```

---

## 11. 開発フェーズ

### Phase 1: 基盤構築（MVP）
- Supabaseプロジェクトセットアップ
- DBスキーマ作成・マイグレーション
- Supabase Auth による認証基盤
- テナント管理の基本実装
- APIサーバーのリファクタリング（Controller/Service層分離）

### Phase 2: コア機能移植
- 見積CRUD（JSON → PostgreSQL）
- ファイルアップロード（ローカル → Supabase Storage）
- ブラウザD&Dスキャナプール
- OCR機能のSaaS対応（AIクレジット消費）
- 会社マスタ移行

### Phase 3: SaaS機能
- Stripe決済連携（サブスクリプション）
- AIクレジット管理
- ユーザー招待・管理画面
- テナント設定画面
- ライセンス制限の実装

### Phase 4: 既存データ移行・テスト
- データ移行スクリプト作成
- 正木鉄工データの移行実行
- 結合テスト・E2Eテスト
- パフォーマンステスト

### Phase 5: デプロイ・ローンチ準備
- Vercel（FE）+ Railway（API）デプロイ
- ドメイン取得・DNS設定
- SSL証明書設定
- ランディングページ作成
- 本番データ移行

---

## 12. 用語集

| 用語 | 説明 |
|------|------|
| テナント | 契約企業の単位。1契約 = 1テナント |
| 親アカウント | テナント管理者。ユーザー払い出し・設定変更権限あり |
| 子アカウント | 親アカウントにより作成されたユーザー |
| ボリュームライセンス | プランごとのユーザー数上限 |
| AIクレジット | AI機能（OCR・スマート見積）利用時に消費されるポイント |
| RLS | Row Level Security。PostgreSQLのテナント分離機構 |
