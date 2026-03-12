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

| Product名 | Price ID（月額） | Price ID（年額） | 金額（月額） | 
|-----------|----------------|----------------|------------|------------|
| AiZumen Small | price_small_monthly | price_small_yearly | ¥10,000 | 
| AiZumen Medium | price_medium_monthly | price_medium_yearly | ¥30,000 | 
| AiZumen Large | price_large_monthly | price_large_yearly | ¥50,000 | 

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

## AIクレジット消費量の設計

| 操作 | 消費クレジット | 備考 |
|------|-------------|------|
| OCR解析（1ファイル） | 1クレジット | 手入力代行としてのコスト |
| AI類似検索（精密解析） | 1クレジット | Gemini によるリランキング実行時 |
| 同一図面検出（pHash） | **0クレジット** | サーバー内計算のみのため消費なし |

> [!NOTE]
> ユーザー体験向上のため、同一図面が高速パス（pHash）で即座に見つかった場合はクレジットを消費しない仕様としています。

---

## 開発・トラブルシューティング

### PDF.js ワーカーのノイズ抑制
PDF.js (react-pdf) は、大規模な図面や複雑な注釈を含むファイルを表示する際、実害のない警告（XFA等）やクリーンアップ時のエラーを大量に出力する傾向があります。これらを `client/src/main.jsx` でインターセプトしています。

- `verbosity = 0`: 内部ログレベルをエラーのみに制限。
- `window.onerror` / `unhandledrejection`: 以下のキーワードを含む「既知のノイズ」を遮断。
    - `Worker was terminated` (スクロールによる描画キャンセル)
    - `XFA - an error occurred` (非対応の注釈形式)

### pHash ハイブリッド検索の仕様
- **dHash (64bit)**: `sharp` または `pdfjs` を通じてグレースケール8x8画像から生成。
- **ハミング距離**: 
    - `0〜2`: 同一図面とみなし Gemini をスキップ。
    - `3〜15`: 類似の可能性があるため Gemini によるリランキング対象。
- **座標系**: サーバー・クライアント間で `0.0〜1.0` の正規化座標を使用し、デバイスピクセル比や解像度の影響を排除。

---

## 既存コード流用箇所
(以下変更なし)
