import React from 'react';
import { X, FileJson, FileSpreadsheet, Info, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ImportGuide({ isOpen, onClose }) {
    if (!isOpen) return null;

    const fields = [
        { name: '会社名', key: 'company_name', type: '文字列', desc: '取引先企業名', default: 'インポート案件' },
        { name: '担当者', key: 'contact_person', type: '文字列', desc: '先方の担当者名', default: '-' },
        { name: '注文番号', key: 'order_number', type: '文字列', desc: '重複チェックの基準になります', default: '-' },
        { name: '工事番号', key: 'construction_number', type: '文字列', desc: '社内管理用の番号', default: '-' },
        { name: 'ステータス', key: 'status', type: '文字列', desc: 'pending, ordered, delivered 等', default: 'pending' },
        { name: '備考', key: 'notes', type: '文字列', desc: '案件全体のメモ', default: '-' },
        { name: '品名', key: 'name', type: '文字列', desc: '明細の品名', default: '品名なし' },
        { name: '数量', key: 'quantity', type: '数値', desc: '受注数量', default: '1' },
        { name: '加工費', key: 'processing_cost', type: '数値', desc: '単価としての金額', default: '0' },
        { name: '材料費', key: 'material_cost', type: '数値', desc: '単価としての金額', default: '0' },
        { name: 'その他', key: 'other_cost', type: '数値', desc: '単価としての金額', default: '0' },
    ];

    const jsonExample = `[
  {
    "company_name": "株式会社マルイチ",
    "order_number": "PO-2024-001",
    "status": "ordered",
    "items": [
      {
        "name": "ブラケット A",
        "quantity": 10,
        "processing_cost": 1500
      },
      {
        "name": "ボルトセット",
        "quantity": 100,
        "processing_cost": 50
      }
    ]
  }
]`;

    const csvExample = `会社名,注文番号,ステータス,品名,数量,加工費
株式会社マルイチ,PO-2024-001,ordered,ブラケット A,10,1500
株式会社マルイチ,PO-2024-002,pending,プレート B,5,3000`;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 rounded-xl">
                            <Info className="text-indigo-400" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">データインポート構造ガイド</h2>
                            <p className="text-xs text-slate-400 mt-0.5">他システムから移行する際の推奨フォーマット</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    {/* Overview */}
                    <section className="space-y-3">
                        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                            <CheckCircle2 size={18} className="text-emerald-400" />
                            対応フォーマット
                        </h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            AiZumenでは、**CSV**および**JSON**形式でのインポートをサポートしています。
                            ヘッダー名（キー名）は日本語と英語（スネークケース/キャメルケース）の両方に対応しています。
                        </p>
                    </section>

                    {/* Fields Table */}
                    <section className="space-y-4">
                        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                            <FileSpreadsheet size={18} className="text-blue-400" />
                            フィールド対応表
                        </h3>
                        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/30">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="bg-slate-800/50 text-slate-300">
                                        <th className="p-3 border-b border-slate-800 font-bold">項目名</th>
                                        <th className="p-3 border-b border-slate-800 font-bold">推奨キー (英語)</th>
                                        <th className="p-3 border-b border-slate-800 font-bold text-center">型</th>
                                        <th className="p-3 border-b border-slate-800 font-bold">説明</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {fields.map((f, i) => (
                                        <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="p-3 font-medium text-slate-200">{f.name}</td>
                                            <td className="p-3">
                                                <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300">{f.key}</code>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${f.type === '数値' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                    {f.type}
                                                </span>
                                            </td>
                                            <td className="p-3 text-slate-400 text-xs">{f.desc}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Format Examples */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* CSV Example */}
                        <section className="space-y-3">
                            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                                <FileSpreadsheet size={18} className="text-emerald-400" />
                                CSV形式（フラット）
                            </h3>
                            <p className="text-xs text-slate-500">
                                1行につき1案件・1明細としてインポートされます。
                            </p>
                            <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 overflow-x-auto font-mono leading-relaxed">
                                {csvExample}
                            </pre>
                        </section>

                        {/* JSON Example */}
                        <section className="space-y-3">
                            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                                <FileJson size={18} className="text-indigo-400" />
                                JSON形式（ネスト可能）
                            </h3>
                            <p className="text-xs text-slate-500">
                                1案件に複数の明細（items）を含めることができます。
                            </p>
                            <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 overflow-x-auto font-mono leading-relaxed">
                                {jsonExample}
                            </pre>
                        </section>
                    </div>

                    {/* Cautions */}
                    <section className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl flex gap-3">
                        <AlertCircle className="text-rose-500 shrink-0" size={20} />
                        <div className="text-sm text-rose-200/80">
                            <p className="font-bold mb-1">注意事項</p>
                            <ul className="list-disc list-inside space-y-1 text-xs opacity-80">
                                <li>ファイルサイズの上限は **10MB** です。</li>
                                <li>「注文番号」が既にシステム内に存在する場合、その行はスキップされます。</li>
                                <li>日付形式は、システムによって自動的に解析されますが、YYYY-MM-DDを推奨します。</li>
                                <li>UTF-8 エンコーディングのファイルを推奨します。</li>
                            </ul>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}
