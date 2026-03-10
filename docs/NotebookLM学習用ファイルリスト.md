# NotebookLM用システム仕様提示資料（推奨リスト）

AiZumenシステムの仕様をNotebookLMに効率的に理解させるために、ソースコード全件ではなく、以下の「信号密度の高い」ドキュメントとコードを優先的に読み込ませることを推奨します。

---

## 1. 業務・運用仕様（最優先）
システムの全体像とビジネスルールを理解するための基本資料です。

*   **[本番運用ガイド_マスターマニュアル.md](file:///c:/Users/正木鉄工/OneDrive/デスクトップ/dev/AiZumen/docs/本番運用ガイド_マスターマニュアル.md)**: 最新の運用フローとチェックリスト。
*   **[requirements.md](file:///c:/Users/正木鉄工/OneDrive/デスクトップ/dev/AiZumen/docs/requirements.md)**: サービスの基本要件。
*   **[role_privileges.md](file:///c:/Users/正木鉄工/OneDrive/デスクトップ/dev/AiZumen/docs/role_privileges.md)**: 権限設計（管理者/閲覧者/SU）の定義。
*   **[task_progress.md](file:///c:/Users/正木鉄工/OneDrive/デスクトップ/dev/AiZumen/docs/task_progress.md)**: これまでの開発履歴と実装済み機能のサマリー。

---

## 2. データ構造・アーキテクチャ
データの持ち方とシステム間の繋がりを理解させるための資料です。

| **[database_schema_consolidated.md](file:///c:/Users/正木鉄工/OneDrive/デスクトップ/dev/AiZumen/docs/database_schema_consolidated.md)** | 全テーブル定義を1つに統合した資料。NotebookLM用。 |
| **[database_design.md](file:///c:/Users/正木鉄工/OneDrive/デスクトップ/dev/AiZumen/docs/database_design.md)** | テーブル定義の設計思想・ER図。 |
| **[quotation_architecture_analysis.md](file:///c:/Users/正木鉄工/OneDrive/デスクトップ/dev/AiZumen/docs/quotation_architecture_analysis.md)** | システム全体のアーキテクチャ解説。 |

---

## 3. コア・ロジック（主要な振る舞い）
ソースコードの中で「定義」や「アルゴリズム」が凝縮されている部分です。

| **[core_logic_consolidated.md](file:///c:/Users/正木鉄工/OneDrive/デスクトップ/dev/AiZumen/docs/core_logic_consolidated.md)** | AI検索、Stripe決済、移行スクリプトの核心ロジックを統合した資料。 |
| **[technical_notes.md](file:///c:/Users/正木鉄工/OneDrive/デスクトップ/dev/AiZumen/docs/technical_notes.md)** | 開発時の技術的な決定事項や注意点のメモ。 |
| **[Implementation_Plan_Drawing_Search.md](file:///c:/Users/正木鉄工/OneDrive/デスクトップ/dev/AiZumen/docs/Implementation_Plan_Drawing_Search.md)** | AI図面検索機能の初期設計・実装計画書。 |

---

## ノートブック作成のヒント
1.  まずは **「1. 業務・運用仕様」** の4つのファイルをアップロードし、「全体像を教えて」と質問してみてください。
2.  その次に **「2. データ構造」** を追加し、データモデルを紐付けて理解させます。
3.  最後に **「3. コア・ロジック」** を加えることで、具体的なAI処理や決済の仕組みまで回答できるようになります。
