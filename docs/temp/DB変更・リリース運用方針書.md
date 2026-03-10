# DB変更・リリース運用方針書

本ドキュメントは、SaaS（AiZumen等）のデータベース（DB）変更を伴う改修において、システム停止時間を最小限に抑え、かつデータの損失や予期せぬ障害を防ぐための標準的な運用手順を定めたものです。

## 1. 事前準備：アプリケーションへの組み込み

メンテナンスモードの導入により、一般ユーザーへの影響を遮断しつつ、開発者が本番環境で安全に最終確認を行える環境を構築します。

### A. 環境変数の設定
VercelやRailwayの管理画面で、以下の環境変数を設定します。

| 環境変数名 | 設定値の例 | 説明 |
| :--- | :--- | :--- |
| `MAINTENANCE_MODE` | `false` (通常) / `true` (メンテ中) | メンテナンス状態を制御するフラグ |
| `MAINTENANCE_BYPASS_TOKEN` | `aizumen-secret-2026-m` | 認証をバイパスするための複雑な文字列 |

> **セキュリティ上の注意**
> `MAINTENANCE_BYPASS_TOKEN` は、推測されにくい十分な長さの文字列（32文字以上のランダム文字列推奨）を使用してください。

### B. メンテナンス・ミドルウェアの実装
Node.js (Express等) で以下のロジックを実装します。クエリパラメータによる初回認証後、Cookieでセッションを維持する方式を採用します。

```javascript
// maintenance.js (Middleware)
const maintenanceMiddleware = (req, res, next) => {
  const isMaintenance = process.env.MAINTENANCE_MODE === 'true';
  const bypassToken = process.env.MAINTENANCE_BYPASS_TOKEN;

  // 1. メンテナンスモードでない、または静的ファイルへのリクエストはスルー
  if (!isMaintenance || req.path.startsWith('/_next') || req.path.includes('.')) {
    return next();
  }

  // 2. クエリパラメータに秘密のトークンがあればCookieに保存してスルー
  // 例: https://example.com/?preview=aizumen-secret-2026-m
  if (req.query.preview === bypassToken) {
    res.cookie('maintenance_bypass', bypassToken, {
      maxAge: 900000, // 15分
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax'
    });
    // クエリパラメータを消してリダイレクト（URLを綺麗にするため）
    const url = new URL(req.url, `https://${req.headers.host}`);
    url.searchParams.delete('preview');
    return res.redirect(url.pathname + url.search);
  }

  // 3. Cookieに有効なトークンを保持していればスルー
  if (req.cookies?.maintenance_bypass === bypassToken) {
    return next();
  }

  // 4. 一般ユーザーは503エラーとともにメンテナンス画面を表示
  res.status(503).render('maintenance-page');
};
```

---

## 2. DBバックアップ・管理手順（Supabase）

DB変更前に、必ず「スキーマ」と「データ」の両方を保護する措置を講じます。

### 手法①：SQLによるクイックバックアップ
影響を受けるテーブルをコピーします。ただし、この方法では**外部キー制約、インデックス、トリガーがコピーされない**ことに注意が必要です。

```sql
-- 既存テーブルをデータごと別名で保存（一時的なデータ退避用）
CREATE TABLE backup_orders_20260310 AS TABLE orders;
CREATE TABLE backup_items_20260310 AS TABLE items;
```

### 手法②：Supabase CLIによる完全なダンプ（推奨）
スキーマ定義（DDL）を含めた完全なバックアップを取得するには、Supabase CLIの利用を強く推奨します。

| ツール | 実行コマンド | 用途 |
| :--- | :--- | :--- |
| **Supabase CLI** | `supabase db dump --remote > schema.sql` | テーブル構造、関数、トリガーの保存 |
| **pg_dump** | `pg_dump [接続文字列] -t orders > orders_data.sql` | 特定テーブルのデータと構造の完全保存 |

---

## 3. リリース作業手順（正常系）

以下の順序で作業を進めることで、不整合の発生リスクを最小化します。

1.  **メンテナンスモード ON**
    Vercel/Railwayの `MAINTENANCE_MODE` を `true` に変更し、再デプロイします。
2.  **DB更新（Up用SQLの実行）**
    SupabaseのSQL Editorで、事前に検証済みのSQLを実行します。
    *   **アドバイス**: 「新カラム追加」は既存アプリを壊しませんが、「カラム名変更」や「型変更」は即座にエラーを招きます。可能な限り「新カラム追加 → データ移行 → 旧カラム削除」のステップに分け、後方互換性を維持してください。
3.  **アプリケーションのデプロイ**
    GitHubの最新コードを本番環境へ反映します。
4.  **開発者による実機確認**
    `https://アプリURL/?preview=秘密のトークン` にアクセスし、新機能の動作やデータの保存状態を確認します。
5.  **メンテナンスモード OFF**
    動作確認に問題がなければ、`MAINTENANCE_MODE` を `false` に戻して一般公開を再開します。

---

## 4. 切り戻し（ロールバック）手順（異常系）

確認時に致命的な問題が発生した場合は、躊躇なく以下の手順でロールバックを実行します。

### ステップ1：アプリケーションの差し戻し
VercelまたはRailwayの管理画面から、一つ前の「成功したデプロイ」を選択して **Rollback / Redeploy** を実行します（所要時間：約30秒）。

### ステップ2：DBの差し戻し
以下のいずれかの方法でDBを以前の状態に戻します。

*   **手法A：Down用SQLの実行**
    事前にGemini等で作成しておいた「変更を取り消すSQL（例: `ALTER TABLE ... DROP COLUMN ...`）」を実行します。
*   **手法B：バックアップテーブルからの復元**
    `CREATE TABLE AS` で作成したバックアップからデータを戻します。

```sql
-- 1. 本番テーブルのデータをクリア（外部キー制約に注意）
TRUNCATE TABLE orders;
-- 2. バックアップからデータを投入
INSERT INTO orders SELECT * FROM backup_orders_20260310;
```

> **注意点**
> メンテナンス中に開発者がテストで投入したデータも消去されます。必要に応じて、テストデータの特定と除外を行ってください。

---

## 5. 運用のベストプラクティス

### データの型変更（文字列 → 数値など）の安全な進め方
「AiZumen」のように精度が求められるシステムでは、型変更は以下の3段階で行うのが最も安全です。

1.  **拡張 (Expand)**: 新しい型のカラム（例: `price_v2`）を追加し、アプリ側で新旧両方のカラムに書き込むように変更する。
2.  **移行 (Migrate)**: 既存のデータを旧カラムから新カラムへバッチ処理でコピーする。
3.  **収縮 (Contract)**: アプリの参照先を完全に新カラムへ切り替え、旧カラムを削除する。

### AI（Gemini等）へのプロンプト例
正確なSQLを得るために、テーブル定義（DDL）をプロンプトに含めるのがコツです。

> 「以下の `orders` テーブルに `status` カラム（文字列型、デフォルト 'draft'）を追加したい。既存データにも値を埋める `Up用SQL` と、この変更を完全に取り消す `Down用SQL` を作成して。
> [ここにテーブル定義を貼り付け]」

この「Up/Downセット」をGitのリポジトリ内で管理（例: `migrations/` フォルダ）することで、チーム全体での事故防止に繋がります。
