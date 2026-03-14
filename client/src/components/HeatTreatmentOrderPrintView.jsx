import React from 'react';
import { createPortal } from 'react-dom';

/**
 * 熱処理注文書の印刷用ビュー
 */
export default function HeatTreatmentOrderPrintView({ quotation, companyInfo }) {
    if (!quotation) return null;

    const today = new Date().toLocaleDateString('ja-JP', {
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).replace(/\//g, '/');

    // 熱処理設定がある明細のみを抽出
    const heatTreatmentItems = (quotation.items || []).filter(item => 
        item.material_metadata?.heatTreatment?.type && item.material_metadata.heatTreatment.type !== 'none'
    );

    const content = (
        <div className="hidden print:block p-12 bg-white text-slate-900 font-['BIZ_UDGothic',_sans-serif]">
            {/* Header */}
            <div className="flex justify-between items-start mb-12">
                <div>
                    <h1 className="text-4xl font-black tracking-[0.2em] text-slate-800 mb-2">熱処理注文書</h1>
                    <p className="text-sm text-slate-500">Heat Treatment Order Form</p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-bold">注文番号: {quotation.orderNumber || quotation.displayId || '---'}</p>
                    <p className="text-sm">発行日: {today}</p>
                </div>
            </div>

            {/* Address Section */}
            <div className="grid grid-cols-2 gap-12 mb-12">
                <div className="space-y-6">
                    <div>
                        <div className="text-xs font-bold text-slate-400 mb-1">加工委託先 御中</div>
                        <div className="text-2xl font-bold border-b-2 border-slate-900 pb-2 flex items-baseline gap-2">
                            {heatTreatmentItems[0]?.material_metadata?.heatTreatment?.vendor || '熱処理業者'}
                            <span className="text-sm font-normal">御中</span>
                        </div>
                    </div>
                </div>

                <div className="text-right space-y-1">
                    <div className="text-xl font-bold mb-2">{companyInfo?.name || 'AiZumen株式会社'}</div>
                    <p className="text-xs">〒{companyInfo?.zip_code || '---'}</p>
                    <p className="text-xs">{companyInfo?.address || '---'}</p>
                    <p className="text-xs">TEL: {companyInfo?.tel || '---'}</p>
                    <p className="text-xs">FAX: {companyInfo?.fax || '---'}</p>
                    <div className="pt-4 flex justify-end">
                        <div className="w-20 h-20 border border-slate-200 rounded flex items-center justify-center text-[10px] text-slate-300">
                            角印
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <table className="w-full border-collapse mb-12">
                <thead>
                    <tr className="bg-slate-900 text-white">
                        <th className="border border-slate-900 p-3 text-left text-[10px] font-bold uppercase tracking-widest">材質 / 適用熱処理</th>
                        <th className="border border-slate-900 p-3 text-left text-[10px] font-bold uppercase tracking-widest">寸法 / 形状</th>
                        <th className="border border-slate-900 p-3 text-right text-[10px] font-bold uppercase tracking-widest">数量</th>
                        <th className="border border-slate-900 p-3 text-left text-[10px] font-bold uppercase tracking-widest">目標硬度 / 備考</th>
                    </tr>
                </thead>
                <tbody>
                    {heatTreatmentItems.length === 0 ? (
                        <tr>
                            <td colSpan="4" className="border border-slate-200 p-8 text-center text-slate-400 text-sm">
                                熱処理委託対象の明細はありません
                            </td>
                        </tr>
                    ) : (
                        heatTreatmentItems.map((item, i) => {
                            const meta = item.material_metadata || {};
                            const ht = meta.heatTreatment || {};
                            const dimStr = meta.dims ? Object.entries(meta.dims).map(([k, v]) => `${k}:${v}`).join(' ') : (item.dimensions || '');
                            
                            return (
                                <tr key={i} className="border-b border-slate-200">
                                    <td className="border border-slate-200 p-3">
                                        <div className="font-bold text-sm">{meta.material || item.name}</div>
                                        <div className="text-xs font-black text-red-600 mt-1">
                                            【{ht.type === 'N' ? '焼きならし (N)' : '焼き入れ (H)'}】
                                        </div>
                                    </td>
                                    <td className="border border-slate-200 p-3">
                                        <div className="text-xs">{meta.shape || '---'}</div>
                                        <div className="text-[10px] text-slate-500">{dimStr}</div>
                                    </td>
                                    <td className="border border-slate-200 p-3 text-right text-sm font-mono">{item.quantity}</td>
                                    <td className="border border-slate-200 p-3">
                                        <div className="font-bold text-sm text-slate-800">{ht.hardness || '指示通り'}</div>
                                        <div className="text-[10px] text-slate-500 mt-1 truncate">{item.notes}</div>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>

            {/* Footer Notes */}
            <div className="mt-auto pt-12 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-400 mb-2">【注意事項】</div>
                <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {"上記内容にて熱処理加工を委託申し上げます。材料は別途、鋼材業者より直送されます。\n加工完了後は弊社工場まで納品をお願いいたします。\n\n納入場所：弊社工場"}
                </div>
            </div>

            <style>{`
                @media print {
                    @page { size: A4; margin: 15mm; }
                }
            `}</style>
        </div>
    );

    const portalTarget = document.getElementById('print-portal');
    if (!portalTarget) return content;

    return createPortal(content, portalTarget);
}
