import React from 'react';
import { createPortal } from 'react-dom';

/**
 * 材料注文書の印刷用ビュー
 * 見積書 (QuotationPrintView.jsx) と構成・フォントを統一
 */
export default function MaterialOrderPrintView({ quotation, companyInfo }) {
    if (!quotation) return null;

    const today = new Date().toLocaleDateString('ja-JP', {
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).replace(/\//g, '/');

    // 材料管理費の計算メタデータがある場合はそれを使用し、ない場合は明細をそのまま表示
    const materialItems = (quotation.items || []).filter(item => item.materialCost > 0);

    const content = (
        <div className="hidden print:block p-12 bg-white text-slate-900 font-['BIZ_UDGothic',_sans-serif] material-order-page">
            {/* Header */}
            <div className="flex justify-between items-start mb-12">
                <div>
                    <h1 className="text-4xl font-black tracking-[0.2em] text-slate-800 mb-2">材料注文書</h1>
                    <p className="text-sm text-slate-500">Material Order Form</p>
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
                        <div className="text-xs font-bold text-slate-400 mb-1">発注先 御中</div>
                        <div className="text-2xl font-bold border-b-2 border-slate-900 pb-2 flex items-baseline gap-2">
                            {/* 注文書ごとに業者が異なる可能性があるため、ここでは便宜上「材料供給業者」とするか、
                                メタデータから抽出する。本来は業者ごとに分けるべきだが、まずは一括で出せるようにする */}
                            {materialItems[0]?.material_metadata?.vendor || '材料供給業者'}
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

            {/* Quotation Info */}
            <div className="bg-slate-50 p-4 rounded-lg mb-8 grid grid-cols-2 gap-4 border border-slate-200">
                <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase mr-3">関連工事番号:</span>
                    <span className="text-sm font-bold">{quotation.constructionNumber || '---'}</span>
                </div>
                <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase mr-3">納入希望日:</span>
                    <span className="text-sm font-bold">{materialItems[0]?.deliveryDate ? materialItems[0].deliveryDate.replace(/-/g, '/') : '別途相談'}</span>
                </div>
                {materialItems[0]?.material_metadata?.heatTreatment?.shipToVendor && (
                    <div className="col-span-2 mt-2 pt-2 border-t border-slate-200">
                        <span className="text-[10px] font-black text-red-500 uppercase mr-3">【直送指示】:</span>
                        <span className="text-sm font-bold text-red-600">
                            以下の熱処理業者へ直送してください：{materialItems[0].material_metadata.heatTreatment.vendor} 御中
                        </span>
                    </div>
                )}
            </div>

            {/* Table */}
            <table className="w-full border-collapse mb-12">
                <thead>
                    <tr className="bg-slate-900 text-white">
                        <th className="border border-slate-900 p-3 text-left text-[10px] font-bold uppercase tracking-widest">材質 / 形状 / 寸法</th>
                        <th className="border border-slate-900 p-3 text-right text-[10px] font-bold uppercase tracking-widest">数量</th>
                        <th className="border border-slate-900 p-3 text-right text-[10px] font-bold uppercase tracking-widest">重量 (kg)</th>
                        <th className="border border-slate-900 p-3 text-right text-[10px] font-bold uppercase tracking-widest">備考</th>
                    </tr>
                </thead>
                <tbody>
                    {materialItems.length === 0 ? (
                        <tr>
                            <td colSpan="4" className="border border-slate-200 p-8 text-center text-slate-400 text-sm">
                                材料発注対象の明細はありません
                            </td>
                        </tr>
                    ) : (
                        materialItems.map((item, i) => {
                            const meta = item.material_metadata || {};
                            const dimStr = meta.dims ? Object.entries(meta.dims).map(([k, v]) => `${k}:${v}`).join(' ') : (item.dimensions || '');
                            
                            return (
                                <tr key={i} className="border-b border-slate-200">
                                    <td className="border border-slate-200 p-3">
                                        <div className="font-bold text-sm">{meta.material || item.name}</div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                            {meta.shape ? `${meta.shape} | ` : ''} {dimStr}
                                            {meta.heatTreatment?.type !== 'none' && (
                                                <span className="ml-2 text-red-500 font-bold border border-red-200 px-1 rounded bg-red-50">
                                                    熱処理:{meta.heatTreatment.type} ({meta.heatTreatment.hardness})
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="border border-slate-200 p-3 text-right text-sm font-mono">{item.quantity}</td>
                                    <td className="border border-slate-200 p-3 text-right text-sm font-mono">{meta.weight || '---'}</td>
                                    <td className="border border-slate-200 p-3 text-xs text-slate-500">{item.notes || ''}</td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>

            {/* Footer Notes */}
            <div className="mt-auto pt-12 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-400 mb-2">【特記事項 / 納品場所】</div>
                <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {quotation.notes || (
                        materialItems.some(i => i.material_metadata?.heatTreatment?.shipToVendor)
                            ? '上記内容にて発注申し上げます。納期、金額等に変更がある場合は至急ご連絡ください。\n（材料は指定の熱処理業者へ直送してください）'
                            : '上記内容にて発注申し上げます。納期、金額等に変更がある場合は至急ご連絡ください。\n納入場所：弊社工場'
                    )}
                </div>
            </div>

            <style>{`
                @media print {
                    @page { size: A4; margin: 15mm; }
                    .material-order-page { page-break-after: always; }
                }
            `}</style>
        </div>
    );

    const portalTarget = document.getElementById('print-portal');
    if (!portalTarget) return content;

    return createPortal(content, portalTarget);
}
