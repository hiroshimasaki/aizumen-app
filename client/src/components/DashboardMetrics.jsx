import { useMemo } from 'react';
import { TrendingUp, FileCheck, Activity, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export default function DashboardMetrics({ quotations, hourlyRate = 8000 }) {
    const metrics = useMemo(() => {
        const total = quotations.length;
        const ordered = quotations.filter(q => q.status === 'ordered').length;
        const delivered = quotations.filter(q => q.status === 'delivered').length;
        const lost = quotations.filter(q => q.status === 'lost').length;
        const pending = quotations.filter(q => q.status === 'pending').length;

        const totalCount = ordered + lost + pending;
        const winRate = totalCount > 0 ? Math.round((ordered / totalCount) * 100) : 0;

        const calculateAmount = (quotes) => {
            return quotes.reduce((sum, q) => {
                let qTotal = 0;
                if (q.items && q.items.length > 0) {
                    qTotal = q.items.reduce((s, i) => {
                        const cost = (Number(i.processingCost) || 0) + (Number(i.materialCost) || 0) + (Number(i.otherCost) || 0);
                        const qty = Number(i.quantity) || 1;
                        return s + (cost * qty);
                    }, 0);
                }
                return sum + qTotal;
            }, 0);
        };

        const orderedAmount = calculateAmount(quotations.filter(q => q.status === 'ordered'));
        const pendingAmount = calculateAmount(quotations.filter(q => q.status !== 'ordered' && q.status !== 'lost'));

        // Calculate Budget vs Actual (Processing ONLY)
        const orderedQuotes = quotations.filter(q => q.status === 'ordered');
        let orderedProcEstTotal = 0;
        let orderedProcActTotal = 0;
        let orderedHasActuals = false;

        orderedQuotes.forEach(q => {
            if (q.items && q.items.length > 0) {
                q.items.forEach(i => {
                    const qty = Number(i.quantity) || 1;
                    orderedProcEstTotal += (Number(i.processingCost) || 0) * qty;

                    let act = Number(i.actualProcessingCost) || 0;
                    const actHours = Number(i.actualHours) || 0;

                    // 実績加工費が未入力で時間がある場合のみ、時間から概算する（QuotationListと同期）
                    if (act <= 0 && actHours > 0) {
                        act = Math.round(actHours * hourlyRate) / qty;
                    }

                    if (act > 0 || actHours > 0) {
                        orderedProcActTotal += Math.round(act * qty);
                        orderedHasActuals = true;
                    }
                });
            }
        });

        const orderedVariance = orderedProcActTotal - orderedProcEstTotal;
        const orderedVariancePct = orderedProcEstTotal > 0 ? (orderedVariance / orderedProcEstTotal) * 100 : 0;

        return {
            total, ordered, delivered, lost, pending, winRate,
            orderedAmount, pendingAmount,
            orderedProcEstTotal, orderedProcActTotal,
            orderedHasActuals, orderedVariance, orderedVariancePct
        };
    }, [quotations, hourlyRate]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Main Stats Row */}
            <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl backdrop-blur-md">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                        <TrendingUp className="text-blue-400" size={18} />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">受注率</span>
                </div>
                <div className="text-2xl font-black text-white">{metrics.winRate}%</div>
                <div className="flex gap-2 mt-1.5 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-1 text-[9px] whitespace-nowrap bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded">
                        検討:{metrics.pending}
                    </div>
                    <div className="flex items-center gap-1 text-[9px] whitespace-nowrap bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">
                        受注:{metrics.ordered}
                    </div>
                    <div className="flex items-center gap-1 text-[9px] whitespace-nowrap bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">
                        納品:{metrics.delivered}
                    </div>
                    <div className="flex items-center gap-1 text-[9px] whitespace-nowrap bg-slate-500/10 text-slate-500 px-1.5 py-0.5 rounded">
                        失注:{metrics.lost}
                    </div>
                </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl backdrop-blur-md">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <Activity className="text-emerald-400" size={18} />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">受注総額</span>
                </div>
                <div className="text-2xl font-black text-emerald-400">¥{metrics.orderedAmount.toLocaleString()}</div>
                <div className="text-[9px] text-slate-500 mt-1">{metrics.ordered} 件の受注</div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl backdrop-blur-md">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                        <FileCheck className="text-amber-400" size={18} />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">検討中残高</span>
                </div>
                <div className="text-2xl font-black text-amber-400">¥{metrics.pendingAmount.toLocaleString()}</div>
                <div className="text-[9px] text-slate-500 mt-1">{metrics.pending} 件の見積中</div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl backdrop-blur-md">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                        <AlertCircle className="text-indigo-400" size={18} />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">収支差 (加工費)</span>
                </div>
                <div className={cn("text-2xl font-black", metrics.orderedVariance > 0 ? "text-red-400" : "text-emerald-400")}>
                    {metrics.orderedVariance > 0 ? '+' : ''}{metrics.orderedVariance.toLocaleString()}
                </div>
                <div className="text-[9px] text-slate-500 mt-1">目標比 {metrics.orderedVariancePct.toFixed(1)}%</div>
            </div>
        </div>
    );
}
