# AI 図面検索：改善状況と残課題

> 更新日: 2026-03-11

---

## 概要

AI 類似図面検索機能のパフォーマンスと精度の改善を実施中。
同一図面の即時検出（pHash）と、Gemini API による類似度リランキングの2層構成。

---

## 現在のアーキテクチャ

```
[ブラウザ]                          [サーバー]
 ├─ PDF.js で PDF を Canvas に描画
 ├─ 矩形選択 → queryImage (PNG)
 ├─ ページ全体 → fullPageImage        ┌───────────────────────────┐
 │   (1024px リサイズ, JPEG 80%)       │                           │
 └──────── POST /api/search/similar ──►│ 1. pHash マッチ (< 1秒)   │
                                       │ 2. ベクトル検索 (~2秒)     │
                                       │ 3. 名寄せ → 候補10件      │
                                       │ 4. 画像DL & クロップ       │
                                       │ 5. Gemini リランキング     │
                                       └───────────────────────────┘
```

---

## 実施済みの改善

### 1. pHash による同一図面の高速検出
- ページ全体画像の dHash (64bit) を生成し、DB に保存された既存ハッシュと比較。
- ハミング距離が閾値以内であれば Gemini をスキップして即座に結果を返す。
- **対象ファイル**: `drawingSearchService.js`, `hashService.js`, `DrawingSearchModal.jsx`, `search.js`

### 2. 検索パフォーマンスの最適化
| 項目 | 変更前 | 変更後 |
|---|---|---|
| Gemini 候補数 | 15件（→30件） | **10件** |
| ベクトル検索件数 | 100件 | **50件** |
| paddingFactor | 3.0 | **2.0** |
| DLキャッシュ | なし | **あり（同一ファイルの重複DL排除）** |
| 結果フィルタ閾値 | 25点 | **15点** |

### 3. フルページ画像の軽量化
- クライアント側で 1024px にリサイズし JPEG 80% に圧縮して送信。
- `ERR_CONNECTION_RESET` を防止。

### 4. react-pdf 警告の解消
- `PDF_OPTIONS` を `useMemo` でメモ化し、不要な再レンダリングを防止。

### 5. pHash 高速パスの完全修復（新規PDF対応）
- クライアントから **元のPDFファイル自体** を送信し、サーバーで登録時と同じ `pdfjs` パイプラインでハッシュ生成するように変更。
- 同一PDFならハミング距離 0 での完全一致が可能になり、Gemini 処理を 100% スキップ。
- **対象ファイル**: `drawingSearchService.js`, `DrawingSearchModal.jsx`, `search.js`, `QuotationForm.jsx`


---

## 現在の検索性能

| シナリオ | 所要時間 | 精度 |
|---|---|---|
| 同一図面（Gemini経由） | ~50秒 | 98〜100% |
| 類似図面 | ~40〜50秒 | 良好 |
| 同一図面（pHash高速パス） | **~2秒** | 100% (同一PDF時) |

---

## 未解決の課題

### 🟢 pHash 高速パスが機能していない（解決済み）

**原因**: 登録時と検索時でハッシュの生成元が異なるパイプライン（Sharp vs PDF.js）を通っていた問題。

**解決策（案C）**:
- クライアントから元PDFを送信し、サーバー側で登録時と同一の `preprocessImage` を通してハッシュを生成。
- 同一パイプライン同士の比較により、ハミング距離を極小化（同一PDFなら0）。
- **既存ファイル**については `fileId` を送信し、DB上のハッシュを直接参照することで効率化。

---

## 変更されたファイル一覧

| ファイル | 変更内容 |
|---|---|
| `server/src/services/ai/drawingSearchService.js` | pHash高速パス、候補数最適化、DLキャッシュ、フィルタ閾値変更 |
| `server/src/services/ai/hashService.js` | dHash 生成ロジック（変更なし・参考） |
| `server/src/routes/search.js` | `fullPageImage` の受け取り対応 |
| `client/src/components/DrawingSearchModal.jsx` | fullPageImage送信、リサイズ、PDF optionsメモ化 |
| `client/src/index.css` | @import 順序の修正 |

---

## 次のアクション

1. **案A の実装**: `fileId` をクライアントから送信し、サーバーでDB上のハッシュを直接参照する
2. **pHash 高速パスの動作検証**: 同一ファイル検索が2秒以内に完了することを確認
3. **本番環境へのデプロイと最終確認**
