# AiZumen 主要ビジネスロジック統合資料 (NotebookLM用)

このドキュメントは、NotebookLMへのアップロード用に、主要な `.js` ファイルのロジックを Markdown 形式に統合したものです。

---

## 1. AI図面検索ロジック (drawingSearchService.js)
図面のタイル分割、ベクトル化、Geminiによるリランキングのコアフローです。

```javascript
/* 
  1. registerDrawing: 図面のインデックス作成
  - PDFを画像に変換し、300x300程度のタイルに分割。
  - 各タイルの特徴量をMobileNetV2等で1280次元のベクトルに変換し、pgvectorに保存。
*/

/* 
  2. searchSimilarDrawing: 類似検索フロー
  - クエリ画像のベクトルを生成。
  - pgvector (match_drawing_tiles) で上位40件の候補を高速抽出。
  - 同一ファイル内での名寄せを行い、上位10件をGeminiに送信。
*/

/* 
  3. rerankWithGemini: Geminiによる精密なリランキング
  - クエリ画像と候補タイル画像をGemini 2.0 Flashに一括入力。
  - 構造、文字情報、スケール、回転を考慮して0-100点でスコアリング。
  - スコア50%以上のものを信頼できる結果として返却。
*/
```

---

## 2. 決済・サブスクリプション管理 (subscription.js)
Stripe連携、プラン変更、クレジット購入の制御ロジックです。

```javascript
/* 
  1. プラン変更 (Downgrade/Upgrade)
  - アップグレード: 即時適用。Stripeで日割り計算 (prorated) を行い、DBとAIクレジット枠を更新。
  - ダウングレード: 規約に基づき次回更新時に適用 (Subscription Schedules)。
  - ※現在の運用では月額プランのみをサポート（年額プランは廃止）。
*/

/* 
  2. AIクレジット購入
  - ワンクリック決済: 保存済みの支払い方法で PaymentIntent を作成・即時確定。
  - 新規決済: Stripe Checkout セッションを作成。
*/

/* 
  3. セルフヒーリング (整合性修復)
  - GETリクエスト時に期限切れを確認し、DBが更新されていなければフリープランへ自動降格。
*/
```

---

## 3. データ移行スクリプト (migrate_all.js)
旧システム(JSON)から新システム(Supabase)への移行ルールです。

```javascript
/* 
  1. ID変換と採番
  - display_id (QYYMMDD-XXX) を生成。衝突時はサフィックス (-1, -2) を付与して回避。
  - 内部IDはUUIDに統一。
*/

/* 
  2. ファイルとベクトルの移行
  - ローカルファイルを Supabase Storage へアップロード。
  - PDFファイルについては、移行と同時に drawingSearchService を呼び出しベクトルを生成。
*/
```
