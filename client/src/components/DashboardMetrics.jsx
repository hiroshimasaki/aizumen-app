import { useMemo } from 'react';
import { TrendingUp, FileCheck, Activity, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function DashboardMetrics({ stats, filterMonth = null, showCharts = true }) {
    const metrics = useMemo(() => {
        if (!stats) return {
            winRate: 0, pending: 0, ordered: 0, delivered: 0, lost: 0,
            salesAmount: 0, pendingAmount: 0, orderedVariance: 0, orderedVariancePct: 0,
            history: []
        };

        const data = filterMonth === 'current' ? stats.currentMonth : stats.allTime;
        return { ...data, history: stats.history || [] };
    }, [stats, filterMonth]);

    const pieData = [
        { name: '納品/受注', value: (metrics.delivered || 0) + (metrics.ordered || 0), color: '#10b981' },
        { name: '検討中', value: metrics.pending || 0, color: '#f59e0b' },
        { name: '失注', value: metrics.lost || 0, color: '#64748b' },
    ];

    return (
        <div className="space-y-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Main Stats Row */}
                <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl backdrop-blur-md relative overflow-hidden group hover:bg-slate-800 transition-all">
                    <div className="flex items-center gap-3 mb-2 relative z-10">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <TrendingUp className="text-blue-400" size={18} />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">受注率</span>
                    </div>
                    <div className="text-3xl font-black text-white relative z-10">{metrics.winRate}%</div>
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
                    <p className="text-[10px] text-slate-500 mt-2">当初見積比 {metrics.orderedVariancePct.toFixed(1)}%</p>
                </div>
            </div>

            {/* Charts Row */}
            {showCharts && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[300px]" style={{ minWidth: 0 }}>
                    <div className="md:col-span-2 bg-slate-800/50 border border-slate-700/50 p-5 rounded-2xl backdrop-blur-md flex flex-col" style={{ minWidth: 0 }}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">売上推移 / 案件数</h3>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase">案件数</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase">売上高</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 h-[220px] relative">
                            <ResponsiveContainer width="100%" height="100%" debounce={50}>
                                <AreaChart data={metrics.history}>
                                    <defs>
                                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#64748b"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(val) => val.split('-').slice(1).join('/')}
                                    />
                                    <YAxis hide />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                                        itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                                        labelStyle={{ fontSize: '12px', fontWeight: 'black', marginBottom: '4px', color: '#fff' }}
                                    />
                                    <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                                    <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 border border-slate-700/50 p-5 rounded-2xl backdrop-blur-md flex flex-col">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">案件ステータス分布</h3>
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <div className="w-full h-[180px] relative">
                                <ResponsiveContainer width="100%" height="100%" debounce={50}>
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            innerRadius={55}
                                            outerRadius={80}
                                            paddingAngle={8}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                                            itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="grid grid-cols-3 gap-4 w-full mt-4 border-t border-slate-700/50 pt-4">
                                {pieData.map((d, i) => (
                                    <div key={i} className="text-center">
                                        <div className="text-sm font-black text-white">{d.value}</div>
                                        <div className="text-[8px] text-slate-500 uppercase font-bold">{d.name}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
