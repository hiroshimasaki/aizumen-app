import { useMemo } from 'react';
import { TrendingUp, FileCheck, Activity, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export default function DashboardMetrics({ stats, filterMonth = null }) {
    const metrics = useMemo(() => {
        if (!stats) return {
            winRate: 0, pending: 0, ordered: 0, delivered: 0, lost: 0,
            salesAmount: 0, pendingAmount: 0, orderedVariance: 0, orderedVariancePct: 0
        };

        const data = filterMonth === 'current' ? stats.currentMonth : stats.allTime;
        return data;
    }, [stats, filterMonth]);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Main Stats Row */}
            <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl backdrop-blur-md relative overflow-hidden group hover:bg-slate-800 transition-all">
                <div className="flex items-center gap-3 mb-2 relative z-10">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                        <TrendingUp className="text-blue-400" size={18} />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">受注率</span>
                </div>
                <div className="text-3xl font-black text-white relative z-10">{Number(metrics.winRate).toFixed(1)}%</div>
                <div className="flex gap-2 mt-2 truncate relative z-10">
                    <span className="text-[10px] text-emerald-400 font-bold">納品:{metrics.delivered}</span>
                    <span className="text-[10px] text-blue-400 font-bold">受注:{metrics.ordered}</span>
                    <span className="text-[10px] text-slate-500">失注:{metrics.lost}</span>
                </div>
                <div className="absolute -bottom-2 -right-2 opacity-10 group-hover:opacity-20 transition-opacity">
                    <TrendingUp size={80} />
                </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl backdrop-blur-md relative overflow-hidden group hover:bg-slate-800 transition-all">
                <div className="flex items-center gap-3 mb-2 relative z-10">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <Activity className="text-emerald-400" size={18} />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">売上高</span>
                </div>
                <div className="text-3xl font-black text-emerald-400 relative z-10">¥{metrics.salesAmount.toLocaleString()}</div>
                <p className="text-[10px] text-slate-500 mt-2">{filterMonth === 'current' ? '今月の納品/納期確定分' : '選択期間の合計売上'}</p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl backdrop-blur-md relative overflow-hidden group hover:bg-slate-800 transition-all">
                <div className="flex items-center gap-3 mb-2 relative z-10">
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                        <FileCheck className="text-amber-400" size={18} />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">検討中残高</span>
                </div>
                <div className="text-3xl font-black text-amber-400 relative z-10">¥{metrics.pendingAmount.toLocaleString()}</div>
                <p className="text-[10px] text-slate-500 mt-2">{metrics.pending} 件の見積が回答済み</p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl backdrop-blur-md relative overflow-hidden group hover:bg-slate-800 transition-all">
                <div className="flex items-center gap-3 mb-2 relative z-10">
                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                        <AlertCircle className="text-indigo-400" size={18} />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">収支差 (加工費)</span>
                </div>
                <div className={cn("text-3xl font-black relative z-10", metrics.orderedVariance > 0 ? "text-red-400" : "text-emerald-400")}>
                    {metrics.orderedVariance > 0 ? '+' : ''}¥{Math.abs(metrics.orderedVariance).toLocaleString()}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">当初見積比 {Number(metrics.orderedVariancePct).toFixed(1)}%</p>
            </div>
        </div>
    );
}
