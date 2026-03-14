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

    // 全ての明細から熱処理エントリを抽出
    const allHTEntries = (quotation.items || []).flatMap((item, itemIdx) => {
        const meta = item.material_metadata;
        if (!meta) return [];
        const entries = Array.isArray(meta) ? meta : (meta.entries || (meta.material ? [meta] : []));
        return entries
            .filter(e => e.heatTreatment?.type && e.heatTreatment.type !== 'none')
            .map(e => ({ ...e, itemIdx, itemQuantity: item.quantity, itemNotes: item.notes, itemName: item.name }));
    });

    // 業者ごとにグループ化
    const vendorGroups = allHTEntries.reduce((groups, entry) => {
        const vendor = entry.heatTreatment?.vendor || '熱処理業者';
        if (!groups[vendor]) groups[vendor] = [];
        groups[vendor].push(entry);
        return groups;
    }, {});

    const vendorNames = Object.keys(vendorGroups);

    const content = (
        <div className="hidden print:block text-slate-900 font-['BIZ_UDGothic',_sans-serif]">
            {vendorNames.length === 0 ? (
                <div className="p-12 bg-white h-[297mm] flex items-center justify-center text-slate-400 text-sm">
                    熱処理委託対象の明細はありません
                </div>
            ) : (
                vendorNames.map((vendor, vIdx) => (
                    <div key={vendor} className="p-12 bg-white h-auto min-h-[297mm] heat-treatment-order-page relative">
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
                                        {vendor}
                                        <span className="text-sm font-normal">御中</span>
                                    </div>
                                </div>
                            </div>

                            <div className="text-right space-y-1">
                                <div className="text-xl font-bold mb-2">{companyInfo?.name || 'AiZumen株式会社'}</div>
                                <p className="text-xs">〒{companyInfo?.zip || '---'}</p>
                                <p className="text-xs">{companyInfo?.address || '---'}</p>
                                <p className="text-xs">TEL: {companyInfo?.phone || '---'}</p>
                                <p className="text-xs">FAX: {companyInfo?.fax || '---'}</p>
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
                                {vendorGroups[vendor].map((entry, entryIdx) => {
                                    const ht = entry.heatTreatment || {};
                                    const dimStr = entry.dims ? Object.entries(entry.dims).map(([k, v]) => `${k}:${v}`).join(' ') : '';
                                    
                                    return (
                                        <tr key={entryIdx} className="border-b border-slate-200">
                                            <td className="border border-slate-200 p-3">
                                                <div className="font-bold text-sm">
                                                    {entry.material || entry.itemName}
                                                </div>
                                                <div className="text-xs font-black text-red-600 mt-1">
                                                    【{ht.type === 'N' ? '焼きならし (N)' : '焼き入れ (H)'}】
                                                </div>
                                            </td>
                                            <td className="border border-slate-200 p-3">
                                                <div className="text-xs">{entry.shape || '---'}</div>
                                                <div className="text-[10px] text-slate-500">{dimStr}</div>
                                            </td>
                                            <td className="border border-slate-200 p-3 text-right text-sm font-mono">{entry.itemQuantity}</td>
                                            <td className="border border-slate-200 p-3">
                                                <div className="font-bold text-sm text-slate-800">{ht.hardness || '指示通り'}</div>
                                                <div className="text-[10px] text-slate-500 mt-1 truncate">{entry.itemNotes}</div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Footer Notes */}
                        <div className="mt-auto pt-12 border-t border-slate-100">
                            <div className="text-xs font-bold text-slate-400 mb-2">【注意事項】</div>
                            <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                                {"上記内容にて熱処理加工を委託申し上げます。材料は別途、鋼材業者より直送されます。\n加工完了後は弊社工場まで納品をお願いいたします。\n\n納入場所：弊社工場"}
                            </div>
                        </div>

                        {vIdx < vendorNames.length - 1 && <div className="page-break" />}
                    </div>
                ))
            )}

            <style>{`
                @media print {
                    @page { size: A4; margin: 15mm; }
                    .heat-treatment-order-page { page-break-after: always; }
                    .heat-treatment-order-page:last-child { page-break-after: auto; }
                }
            `}</style>
        </div>
    );

    const portalTarget = document.getElementById('print-portal');
    if (!portalTarget) return content;

    return createPortal(content, portalTarget);
}
