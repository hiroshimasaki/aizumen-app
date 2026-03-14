import React from 'react';
import { createPortal } from 'react-dom';

export default function MaterialOrderPrintView({ quotation, companyInfo }) {
    if (!quotation) return null;

    const today = new Date().toLocaleDateString('ja-JP', {
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).replace(/\//g, '/');

    // --- データ抽出 ---
    const allItems = quotation.items || [];
    
    // 材料発注データの抽出
    const materialVendorGroups = allItems.reduce((acc, item, itemIdx) => {
        const meta = item.material_metadata;
        if (!meta) return acc;
        const entries = Array.isArray(meta) ? meta : (meta.entries || (meta.material ? [meta] : []));
        
        entries.forEach(entry => {
            const vendor = entry.vendor || '材料供給業者';
            if (!acc[vendor]) acc[vendor] = [];
            const formattedDims = entry.dims ? Object.values(entry.dims).join(' x ') : item.dimensions;
            acc[vendor].push({
                ...entry,
                itemIdx,
                itemQuantity: item.quantity,
                itemNotes: item.notes,
                itemName: item.name,
                itemDimensions: formattedDims
            });
        });
        return acc;
    }, {});

    // 熱処理発注データの抽出
    const heatTreatmentGroups = allItems.reduce((acc, item, itemIdx) => {
        // 1. トップレベルの熱処理情報をチェック
        const topHT = item.heat_treatment;
        if (topHT && topHT.type && topHT.type !== 'none') {
            const vendor = topHT.vendor || '熱処理業者';
            if (!acc[vendor]) acc[vendor] = [];
            acc[vendor].push({
                itemName: item.name,
                itemDimensions: item.dimensions,
                itemQuantity: item.quantity,
                itemNotes: item.notes,
                htType: topHT.type,
                htHardness: topHT.hardness,
                htNotes: topHT.notes,
                htRecord: topHT.record, // 熱処理記録
                materialVendor: '弊社支給' 
            });
        }

        // 2. 材料メタデータ内の各エントリの熱処理情報をチェック
        const meta = item.material_metadata;
        if (meta) {
            const entries = Array.isArray(meta) ? meta : (meta.entries || []);
            entries.forEach(entry => {
                const ht = entry.heatTreatment;
                if (ht && ht.type && ht.type !== 'none') {
                    const vendor = ht.vendor || '熱処理業者';
                    if (!acc[vendor]) acc[vendor] = [];
                    acc[vendor].push({
                        itemName: `${item.name} (${entry.material || '材料'})`,
                        itemDimensions: entry.dims ? Object.entries(entry.dims).map(([k, v]) => `${k}:${v}`).join(' ') : item.dimensions,
                        itemQuantity: item.quantity,
                        itemNotes: item.notes,
                        htType: ht.type,
                        htHardness: ht.hardness,
                        htNotes: ht.notes,
                        htRecord: ht.record, // 熱処理記録
                        materialVendor: entry.vendor || '材料業者',
                        itemIdx 
                    });
                }
            });
        }
        return acc;
    }, {});

    const materialVendors = Object.keys(materialVendorGroups);
    const htVendors = Object.keys(heatTreatmentGroups);

    // --- 各ページのレンダリング関数 ---
    const renderOrderPage = (title, vendorName, entries, type = 'material') => {
        const isHT = type === 'ht';
        return (
            <div key={`${title}-${vendorName}`} className="p-12 bg-white h-auto min-h-[297mm] order-page-content relative border-b last:border-0 print:border-0">
                {/* Header */}
                <div className="flex justify-between items-start mb-12">
                    <div>
                        <h1 className="text-4xl font-black tracking-[0.2em] text-slate-800 mb-2">{title}</h1>
                        <p className="text-sm text-slate-500">{isHT ? 'Heat Treatment Order' : 'Material Purchase Order'}</p>
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
                                {vendorName}
                                <span className="text-sm font-normal">御中</span>
                            </div>
                        </div>

                        {/* 直送指示バナー (材料注文書のみ) */}
                        {!isHT && entries.some(e => e.heatTreatment?.shipToVendor) && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4">
                                <div className="text-red-700 font-bold text-sm mb-1 italic tracking-wider">【!! 重要：熱処理業者への直送指示有 !!】</div>
                                <div className="text-red-600 text-xs font-bold underline decoration-red-300">
                                    配送先：{entries.find(e => e.heatTreatment?.shipToVendor)?.heatTreatment?.vendor || '熱処理業者'} 御中
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="text-right space-y-1">
                        <div className="text-xl font-bold mb-2">{companyInfo?.name || 'AiZumen株式会社'}</div>
                        <p className="text-xs">〒{companyInfo?.zip || '---'}</p>
                        <p className="text-xs">{companyInfo?.address || '---'}</p>
                        <p className="text-xs">TEL: {companyInfo?.phone || '---'}</p>
                        <p className="text-xs">FAX: {companyInfo?.fax || '---'}</p>
                    </div>
                </div>

                {/* Info Bar */}
                <div className="bg-slate-50 p-4 rounded-lg mb-8 grid grid-cols-2 gap-4 border border-slate-200">
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase mr-3">関連工事番号:</span>
                        <span className="text-sm font-bold">{quotation.constructionNumber || '---'}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase mr-3">納入希望日:</span>
                        <span className="text-sm font-bold">別途相談</span>
                    </div>
                </div>

                {/* Table */}
                <table className="w-full border-collapse mb-12">
                    <thead>
                        <tr className="bg-slate-900 text-white">
                            <th className="border border-slate-900 p-3 text-left text-[10px] font-bold uppercase tracking-widest">
                                {isHT ? '品名 / 寸法 / 指示内容' : '材質 / 形状 / 寸法'}
                            </th>
                            <th className="border border-slate-900 p-3 text-right text-[10px] font-bold uppercase tracking-widest w-20">数量</th>
                            <th className="border border-slate-900 p-3 text-right text-[10px] font-bold uppercase tracking-widest w-32">
                                {isHT ? '特記' : '重量 (kg)'}
                            </th>
                            <th className="border border-slate-900 p-3 text-right text-[10px] font-bold uppercase tracking-widest">備考</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((entry, idx) => (
                            <tr key={idx} className="border-b border-slate-200">
                                <td className="border border-slate-200 p-3">
                                    <div className="font-bold text-sm">{entry.material || entry.itemName}</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                        {isHT ? (
                                            <div className="space-y-1">
                                                <div className="text-blue-600 font-bold">処理: {entry.htType} | 硬度: {entry.htHardness}</div>
                                                <div className="text-[10px] text-slate-500">
                                                    入荷元: <span className="font-bold text-slate-700">{entry.materialVendor}</span>
                                                    {entry.itemDimensions && <span className="ml-2">寸法: {entry.itemDimensions}</span>}
                                                </div>
                                                {entry.htRecord && <div className="text-red-500 font-bold border-t border-red-100 pt-1">【熱処理記録必要】</div>}
                                            </div>
                                        ) : (
                                            <>
                                                {`${entry.shape ? entry.shape + ' | ' : ''} ${entry.itemDimensions || ''}`}
                                                {entry.heatTreatment?.type && entry.heatTreatment.type !== 'none' && (
                                                    <span className="ml-2 text-red-500 font-bold border border-red-200 px-1 rounded bg-red-50">
                                                        熱処理:{entry.heatTreatment.type} ({entry.heatTreatment.hardness})
                                                        {entry.heatTreatment.shipToVendor && ' [直送]'}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </td>
                                <td className="border border-slate-200 p-3 text-right text-sm font-mono">{entry.itemQuantity}</td>
                                <td className="border border-slate-200 p-3 text-right text-sm font-mono">
                                    {isHT ? (entry.htNotes || '---') : (entry.weight || '---')}
                                </td>
                                <td className="border border-slate-200 p-3 text-xs text-slate-500">{entry.itemNotes}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Footer Notes */}
                <div className="mt-auto pt-12 border-t border-slate-100">
                    <div className="text-xs font-bold text-slate-400 mb-2">【特記事項 / 納品場所】</div>
                    <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {quotation.notes || (isHT ? '上記内容にて熱処理を依頼申し上げます。' : '上記内容にて発注申し上げます。納入場所：弊社工場')}
                    </div>
                </div>

                <div className="print:page-break-after-always" />
            </div>
        );
    };

    const content = (
        <div className="hidden print:block text-slate-900 font-['BIZ_UDGothic',_sans-serif]">
            {/* 材料注文書セクション */}
            {materialVendors.map(vendor => renderOrderPage('材料注文書', vendor, materialVendorGroups[vendor], 'material'))}
            
            {/* 熱処理注文書セクション */}
            {htVendors.map(vendor => renderOrderPage('熱処理注文書', vendor, heatTreatmentGroups[vendor], 'ht'))}

            {materialVendors.length === 0 && htVendors.length === 0 && (
                <div className="p-12 bg-white h-[297mm] flex items-center justify-center text-slate-400 text-sm">
                    発注対象の明細はありません
                </div>
            )}

            <style>{`
                @media print {
                    @page { size: A4; margin: 0; }
                    body { margin: 0; padding: 0; }
                    .order-page-content { 
                        page-break-after: always !important;
                        height: 297mm;
                        overflow: hidden;
                    }
                    .order-page-content:last-of-type { 
                        page-break-after: auto !important;
                    }
                }
            `}</style>
        </div>
    );

    const portalTarget = document.getElementById('print-portal');
    if (!portalTarget) return content;

    return createPortal(content, portalTarget);
}
