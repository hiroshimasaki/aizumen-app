# AiZumen - 技術メモ・開発ガイド

> **作成日**: 2026-03-01

---

## Supabase設定メモ

### プロジェクト作成手順
1. [supabase.com](https://supabase.com) でプロジェクト作成
2. リージョン: `Northeast Asia (Tokyo)` 推奨
3. DB Password を安全に保管

### 環境変数

```env
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Gemini AI
GEMINI_API_KEY=...

# アプリケーション
APP_URL=https://aizumen.com
API_URL=https://api.aizumen.com
NODE_ENV=development
PORT=3001
```

### Supabase Auth JWTカスタムクレーム

テナントIDをJWTに含めるため、`auth.users`のメタデータを活用:

```sql
-- ユーザー作成時にraw_app_meta_dataにtenant_idを設定
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"tenant_id": "uuid-here"}'
WHERE id = 'user-uuid';
```

RLSポリシーでの使用:
```sql
-- JWTからtenant_idを取得
(auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID
```

---

## Stripe設定メモ

### Products作成（Stripeダッシュボード）

| Product名 | Price ID（月額） | Price ID（年額） | 金額（月額） | 金額（年額） |
|-----------|----------------|----------------|------------|------------|
| AiZumen Small | price_small_monthly | price_small_yearly | ¥10,000 | ¥108,000 |
| AiZumen Medium | price_medium_monthly | price_medium_yearly | ¥30,000 | ¥324,000 |
| AiZumen Large | price_large_monthly | price_large_yearly | ¥50,000 | ¥540,000 |

### AIクレジットパック（ワンタイム）

| Product名 | 数量 | 金額 |
|-----------|------|------|
| 要設計 | 要設計 | 要設計 |

### Webhook設定
エンドポイント: `https://api.aizumen.com/api/webhooks/stripe`

監視イベント:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

---

## デプロイ設定メモ

### Vercel（フロントエンド）
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Root Directory: `client/`
- 環境変数: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`

### Railway（APIサーバー）
- Start Command: `npm start`
- Root Directory: `server/`
- 環境変数: Supabase, Stripe, Gemini 等の全シークレット
- ヘルスチェック: `GET /api/health`

### ドメイン設定
- フロントエンド: `aizumen.com` → Vercel
- API: `api.aizumen.com` → Railway
- DNS: Vercel/Railway が提供するCNAMEレコードを設定

---

## AIクレジット消費量の設計案

| 操作 | 消費クレジット | 備考 |
|------|-------------|------|
| OCR解析（1ファイル） | 1クレジット | Gemini API 1回呼び出し |
| 一括OCR（N ファイル） | N クレジット | ファイル数分 |
| スマート見積 | 2クレジット | より高度なAI処理 |

### プランごとの月間クレジット

| プラン | 月間クレジット | 備考 |
|-------|-------------|------|
| Small | 100 | 約20件/ユーザー/月 |
| Medium | 500 | |
| Large | 1500 | |

> [!NOTE]
> 上記は暫定値。実際のGemini API利用コストを測定して調整する必要がある。

---

## 既存コード流用箇所

### そのまま流用可能
- `PdfPageEditor.jsx` - PDFページ編集
- `PdfThumbnail.jsx` - PDFサムネイル
- `QuotationPrintView.jsx` - 見積印刷
- `ScheduleGantt.jsx` - ガントチャート（データソースのみ変更）
- `parsePrice.js` - 金額パース関数

### 改修して流用
- `QuotationForm.jsx` - テナント対応・Supabase Storage対応
- `QuotationList.jsx` - DB検索・ページネーション対応
- `Dashboard.jsx` - データソース変更
- `AnalysisView.jsx` - データソース変更
- `DeliveryBatchList.jsx` - データソース変更
- `SmartEstimator.jsx` - AIクレジット消費チェック追加
- `ScannerPoolModal.jsx` - D&Dアップロード方式に全面改修

### 新規作成
- 認証画面（Login, Signup, ResetPassword）
- ユーザー管理画面
- テナント設定画面
- サブスクリプション管理画面
- AIクレジット管理画面
- ランディングページ
