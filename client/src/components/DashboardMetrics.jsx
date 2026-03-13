import { useMemo } from 'react';
import { TrendingUp, FileCheck, Activity, AlertCircle, CalendarDays } from 'lucide-react';
import { cn } from '../lib/utils';

export default function DashboardMetrics({ stats, filterMonth = null }) {
    const metrics = useMemo(() => {
        if (!stats) return {
            winRate: 0, pending: 0, ordered: 0, delivered: 0, lost: 0,
            salesAmount: 0, pendingAmount: 0, orderedVariance: 0, orderedVariancePct: 0
        };

        return filterMonth === 'current' ? stats.currentMonth : stats.allTime;
    }, [stats, filterMonth]);

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
                        <TrendingUp className="text-emerald-400" size={18} />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">売上 {filterMonth === 'current' ? '(今月)' : ''}</span>
                </div>
                <div className="text-2xl font-black text-emerald-400">¥{metrics.salesAmount.toLocaleString()}</div>
                <div className="text-[9px] text-slate-500 mt-1">{filterMonth === 'current' ? '今月納品/納期' : '全期間の受注'}</div>
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
                    ¥{Math.abs(metrics.orderedVariance).toLocaleString()}
                </div>
                <div className="text-[9px] text-slate-500 mt-1">目標比 {metrics.orderedVariancePct.toFixed(1)}%</div>
            </div>
        </div>
    );
}
