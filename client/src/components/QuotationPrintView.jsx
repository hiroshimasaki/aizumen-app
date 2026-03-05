import React from 'react';

export default function QuotationPrintView({ quotation, companyInfo }) {
    if (!quotation) return null;

    const info = {
        name: companyInfo?.name || '',
        zip: companyInfo?.zip || '',
        address: companyInfo?.address || '',
        tel: companyInfo?.phone || '',
        fax: companyInfo?.fax || '',
        email: companyInfo?.email || ''
    };

    // Calculate totals
    const total = (quotation.items || []).reduce((sum, item) => {
        const cost = (Number(item.processingCost) || 0) + (Number(item.materialCost) || 0) + (Number(item.otherCost) || 0);
        return sum + (cost * (item.quantity || 1));
    }, 0);

    const tax = Math.floor(total * 0.1);
    const grandTotal = total + tax;

    const todayDateStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });

    return (
        <div id="print-area" className="hidden print:block p-8 bg-white text-black font-serif fixed inset-0 z-[100] m-0 overflow-visible h-screen w-screen">
            <div className="flex justify-between items-start mb-8 pb-2 border-b border-slate-200">
                <h1 className="text-2xl font-bold tracking-widest">御見積書</h1>
                <div className="text-right">
                    <p className="text-sm">No. {quotation.orderNumber || quotation.displayId || quotation.id}</p>
                    <p className="text-sm">日付: {todayDateStr}</p>
                </div>
            </div>

            <div className="flex justify-between mb-8">
                <div className="w-1/2">
                    <div className="mb-4">
                        <h2 className="text-xl border-b border-black inline-block min-w-[300px] pb-1">
                            {quotation.companyName} 御中
                        </h2>
                    </div>
                    <p className="mt-4 text-sm whitespace-pre-line">
                        下記の通り、御見積り申し上げます。
                    </p>
                </div>

                <div className="w-1/2 text-right relative text-sm">
                    <div className="space-y-1">
                        <p className="text-lg font-bold">{info.name}</p>
                        <p>〒{info.zip}</p>
                        <p>{info.address}</p>
                        <p>TEL: {info.tel}</p>
                        <p>FAX: {info.fax}</p>
                        <p>Email: {info.email}</p>
                    </div>
                    <div className="absolute right-0 bottom-[-20px] w-16 h-16 border-2 border-red-500 rounded-full flex items-center justify-center text-red-500 font-bold rotate-12 opacity-80 leading-tight text-xs border-dashed">
                        社印
                    </div>
                </div>
            </div>

            <div className="mb-8 p-4 bg-slate-50 border-2 border-black flex justify-between items-center">
                <span className="text-base font-bold tracking-widest">御見積合計金額（税込）</span>
                <span className="text-2xl font-bold tracking-tight">¥ {grandTotal.toLocaleString()} -</span>
            </div>

            <table className="w-full border-collapse border border-black mb-8 text-sm">
                <thead>
                    <tr className="bg-slate-100 text-[10px]">
                        <th className="border border-black p-1 text-center w-6 tracking-widest">No</th>
                        <th className="border border-black p-1 text-left min-w-[200px] tracking-widest">品名</th>
                        <th className="border border-black p-1 text-center w-12 tracking-widest">加工費</th>
                        <th className="border border-black p-1 text-center w-12 tracking-widest">材料費</th>
                        <th className="border border-black p-1 text-center w-12 tracking-widest">その他</th>
                        <th className="border border-black p-1 text-center w-10 tracking-widest">数量</th>
                        <th className="border border-black p-1 text-center w-10 tracking-widest">単位</th>
                        <th className="border border-black p-1 text-center w-24 tracking-widest">金額</th>
                        <th className="border border-black p-1 text-left w-24 tracking-widest">納期</th>
                    </tr>
                </thead>
                <tbody>
                    {(quotation.items || []).map((item, idx) => {
                        const amount = ((Number(item.processingCost) || 0) + (Number(item.materialCost) || 0) + (Number(item.otherCost) || 0)) * (item.quantity || 1);
                        return (
                            <tr key={idx} className="h-8">
                                <td className="border border-black p-1 text-center text-xs">{idx + 1}</td>
                                <td className="border border-black p-1 text-xs font-bold">{item.name}</td>
                                <td className="border border-black p-1 text-right text-[10px]">{(Number(item.processingCost) || 0).toLocaleString()}</td>
                                <td className="border border-black p-1 text-right text-[10px]">{(Number(item.materialCost) || 0).toLocaleString()}</td>
                                <td className="border border-black p-1 text-right text-[10px]">{(Number(item.otherCost) || 0).toLocaleString()}</td>
                                <td className="border border-black p-1 text-center text-xs">{item.quantity}</td>
                                <td className="border border-black p-1 text-center text-[10px]">個</td>
                                <td className="border border-black p-1 text-right text-xs">¥{amount.toLocaleString()}</td>
                                <td className="border border-black p-1 text-[9px] truncate">
                                    {item.dueDate ? new Date(item.dueDate).toLocaleDateString('ja-JP') : ''}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="text-xs">
                        <td colSpan="7" className="border border-black p-1 text-right font-bold tracking-widest">小計</td>
                        <td className="border border-black p-1 text-right font-bold">¥{total.toLocaleString()}</td>
                        <td className="border border-black p-1"></td>
                    </tr>
                    <tr className="text-xs">
                        <td colSpan="7" className="border border-black p-1 text-right font-bold tracking-widest">消費税 (10%)</td>
                        <td className="border border-black p-1 text-right">¥{tax.toLocaleString()}</td>
                        <td className="border border-black p-1"></td>
                    </tr>
                    <tr className="bg-slate-50 font-bold text-sm">
                        <td colSpan="7" className="border border-black p-1 text-right tracking-widest">合計</td>
                        <td className="border border-black p-1 text-right text-base text-black decoration-double underline">¥{grandTotal.toLocaleString()}</td>
                        <td className="border border-black p-1"></td>
                    </tr>
                </tfoot>
            </table>

            <div className="border border-black p-4 min-h-[100px]">
                <p className="text-xs font-bold border-b border-black mb-2 inline-block tracking-widest">【 備考 】</p>
                <p className="text-xs whitespace-pre-wrap leading-relaxed">{quotation.notes}</p>
            </div>

            <div className="mt-8 text-[10px] text-slate-500 text-center tracking-widest">
                振込手数料は貴社にてご負担願います。有効期限：お見積り日より30日間
            </div>
        </div>
    );
}
