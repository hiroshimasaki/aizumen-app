import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, Users, PieChart, ArrowUpRight, ArrowDownRight, Award, X, User, Mail, StickyNote, FileText, Calendar, DownloadCloud, Lock, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import api from '../lib/api';
import { cn } from '../lib/utils';
import AIMonthlyReport from './AIMonthlyReport';

const AnalysisLockOverlay = ({ title = "Proプラン限定機能" }) => (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/85 backdrop-blur-[4px] rounded-2xl border border-white/5 animate-in fade-in duration-500">
        <div className="p-3 bg-slate-950/80 border border-slate-700 rounded-full mb-3 shadow-xl">
            <Lock size={20} className="text-amber-400" />
        </div>
        <div className="text-center px-4">
            <h4 className="text-sm font-bold text-white mb-1">{title}</h4>
            <p className="text-[10px] text-slate-300 mb-4 max-w-[180px] mx-auto leading-relaxed">
                収益の可視化や利益率の順位など、高度な分析を利用するにはProプランへのアップグレードが必要です。
            </p>
            <Link 
                to="/admin?tab=billing" 
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-[10px] font-black rounded-lg shadow-lg shadow-blue-500/20 transition-all hover:scale-105"
            >
                プランを確認する
            </Link>
        </div>
    </div>
);

export default function AnalysisView({ quotations, stats, period = 'all', hourlyRate = 8000, isPro = false }) {
    const [selectedId, setSelectedId] = useState(null);

    // Helper function for percentage calculation
    function pctSafe(val, total) {
        if (!total || total <= 0) return "0.0";
        return ((val / total) * 100).toFixed(1);
    }

    useEffect(() => {
        if (selectedId) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [selectedId]);

    const analysisData = useMemo(() => {
        const validStatuses = ['ordered', 'delivered'];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Helper to get the most relevant date for a quotation
        const getTargetDate = (q) => {
            const latestDelivery = (q.items || []).reduce((acc, item) => {
                const d = item.deliveryDate ? new Date(item.deliveryDate) : null;
                if (d && !isNaN(d.getTime())) {
                    if (!acc || d > acc) return d;
                }
                return acc;
            }, null);
            return latestDelivery || (q.createdAt ? new Date(q.createdAt) : new Date());
        };

        // Unified period filtering
        const filteredQuotations = quotations.filter(q => {
            if (period === 'all') return true;
            const targetDate = getTargetDate(q);
            if (period === 'current') {
                return targetDate.getMonth() === currentMonth && targetDate.getFullYear() === currentYear;
            }
            let months = 0;
            if (period === '3months') months = 3;
            else if (period === '6months') months = 6;
            else if (period === '1year') months = 12;

            const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
            return targetDate >= cutoff;
        });

        const ordered = filteredQuotations.filter(q => validStatuses.includes(q.status));

        // 1. Monthly Revenue Trend (Always 6 months for trend)
        const monthsToShow = 6;
        const monthlyRevenue = {};
        for (let i = 0; i < monthsToShow; i++) {
            const d = new Date(currentYear, currentMonth - i, 1);
            const mStr = String(d.getMonth() + 1).padStart(2, '0');
            const key = `${d.getFullYear()}/${mStr}`;
            monthlyRevenue[key] = { proc: 0, mat: 0, other: 0, total: 0, sales: 0, count: 0 };
        }

        quotations.filter(q => validStatuses.includes(q.status)).forEach(q => {
            const targetDate = getTargetDate(q);
            const mStr = String(targetDate.getMonth() + 1).padStart(2, '0');
            const key = `${targetDate.getFullYear()}/${mStr}`;
            
            if (monthlyRevenue.hasOwnProperty(key)) {
                monthlyRevenue[key].count += 1;
                (q.items || []).forEach(item => {
                    const qty = Number(item.quantity) || 1;
                    const p = (Number(item.processingCost) || 0) * qty;
                    const m = (Number(item.materialCost) || 0) * qty;
                    const o = (Number(item.otherCost) || 0) * qty;
                    const itemTotal = p + m + o;
                    monthlyRevenue[key].proc += p;
                    monthlyRevenue[key].mat += m;
                    monthlyRevenue[key].other += o;
                    monthlyRevenue[key].total += itemTotal;
                    monthlyRevenue[key].sales += itemTotal;
                });
            }
        });

        const trendData = Object.entries(monthlyRevenue)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, data]) => ({ 
                month,
                date: month.replace('/', '-'), 
                ...data 
            }));

        // 2. Profitability Ranking (Processing Margin ONLY)
        const profitability = ordered.map(q => {
            let estProcTotal = 0;
            let actProcTotal = 0;
            let hasActuals = false;

            (q.items || []).forEach(item => {
                const qty = Number(item.quantity) || 1;
                estProcTotal += (Number(item.processingCost) || 0) * qty;

                let act = Number(item.actualProcessingCost) || 0;
                const actHours = Number(item.actualHours) || 0;

                if (act <= 0 && actHours > 0) {
                    act = Math.round(actHours * hourlyRate) / qty;
                }

                if (act > 0 || actHours > 0) {
                    actProcTotal += Math.round(act * qty);
                    hasActuals = true;
                }
            });

            const margin = estProcTotal - actProcTotal;
            const marginPct = estProcTotal > 0 ? (margin / estProcTotal) * 100 : 0;

            return {
                id: q.id,
                company: q.companyName,
                subject: (q.items && q.items[0] && q.items[0].name) || '無題',
                estProcTotal, actProcTotal, margin, marginPct, hasActuals
            };
        }).filter(p => p.hasActuals).sort((a, b) => b.marginPct - a.marginPct);

        // 3. Company Statistics
        const companyStats = {};
        filteredQuotations.forEach(q => {
            const name = q.companyName || '(不明)';
            if (!companyStats[name]) companyStats[name] = { total: 0, ordered: 0, amount: 0 };
            companyStats[name].total += 1;
            if (validStatuses.includes(q.status)) {
                companyStats[name].ordered += 1;
                const amount = (q.items || []).reduce((sum, item) => {
                    const cost = (Number(item.processingCost) || 0) + (Number(item.materialCost) || 0) + (Number(item.otherCost) || 0);
                    return sum + Math.round(cost * (Number(item.quantity) || 1));
                }, 0);
                companyStats[name].amount += amount;
            }
        });

        const topCompanies = Object.entries(companyStats)
            .map(([name, stats]) => ({ name, ...stats, winRate: ((stats.ordered / stats.total) * 100).toFixed(1) }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);

        // 4. Processing Cost Performance (Plan vs Actual)
        // Only include items where actual results (cost or hours) have been recorded
        let totalPlan = 0;
        let totalActual = 0;
        let itemsWithActuals = 0;

        ordered.forEach(q => {
            (q.items || []).forEach(item => {
                const qty = Number(item.quantity) || 1;
                let actualVal = 0;
                let hasActual = false;

                if (item.actualProcessingCost && Number(item.actualProcessingCost) > 0) {
                    actualVal = Math.round(Number(item.actualProcessingCost) * qty);
                    hasActual = true;
                } else if (item.actualHours && Number(item.actualHours) > 0) {
                    actualVal = Math.round(Number(item.actualHours) * hourlyRate);
                    hasActual = true;
                }

                if (hasActual) {
                    totalPlan += Math.round((Number(item.processingCost) || 0) * qty);
                    totalActual += actualVal;
                    itemsWithActuals++;
                }
            });
        });

        const history = stats?.history || [];
        const pieData = [
            { name: '納品/受注', value: filteredQuotations.filter(q => validStatuses.includes(q.status)).length, color: '#10b981' },
            { name: '検討中', value: filteredQuotations.filter(q => q.status === 'pending').length, color: '#f59e0b' },
            { name: '失注', value: filteredQuotations.filter(q => q.status === 'lost').length, color: '#64748b' },
        ];

        return { 
            trendData, 
            profitability, 
            topCompanies, 
            history,
            pieData,
            procPerformance: { 
                totalPlan, 
                totalActual, 
                itemsWithActuals,
                diff: totalPlan - totalActual,
                efficiency: totalPlan > 0 ? ((totalPlan - totalActual) / totalPlan * 100).toFixed(1) : "0.0"
            } 
        };
    }, [quotations, period, hourlyRate]);

    const { maxRevenue, maxCount } = useMemo(() => {
        const data = analysisData.trendData;
        const rawMaxRev = Math.max(...data.map(d => d.sales || 0), 0);
        const rawMaxCount = Math.max(...data.map(d => d.count || 0), 0);

        // バッファ（10%）を持たせて、データが0でも最小限のレンジを確保
        const finalMaxRev = rawMaxRev === 0 ? 100000 : rawMaxRev * 1.1;
        const finalMaxCount = rawMaxCount === 0 ? 10 : rawMaxCount * 1.1;

        return { maxRevenue: finalMaxRev, maxCount: finalMaxCount };
    }, [analysisData.trendData]);


    const reportMonth = useMemo(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }, []);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 1. AI Analysis Section */}
            <AIMonthlyReport defaultMonth={reportMonth} isPro={isPro} />

            {/* 2. Trends and Distribution Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Trend - 2/3 width */}
                <div className="lg:col-span-2 bg-slate-800/80 p-6 rounded-2xl border border-slate-700 backdrop-blur-md flex flex-col h-[380px]">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-900/30 text-blue-400 rounded-lg">
                                <TrendingUp size={20} />
                            </div>
                            <h3 className="font-bold text-slate-200">売上推移 / 案件数</h3>
                        </div>
                        <div className="flex gap-4 text-xs font-bold text-slate-500">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                <span>案件数</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                <span>売上高</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={analysisData.trendData}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
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
                                <YAxis 
                                    yAxisId="left"
                                    orientation="left"
                                    stroke="#64748b"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    domain={[0, maxRevenue]}
                                    tickFormatter={(val) => val >= 10000 ? `¥${(val / 10000).toFixed(0)}万` : `¥${Math.round(val).toLocaleString()}`}
                                />
                                <YAxis 
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="#3b82f6"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    domain={[0, maxCount]}
                                    allowDecimals={false}
                                    hide={false}
                                />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                                    itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                                    labelStyle={{ fontSize: '12px', fontWeight: 'black', marginBottom: '4px', color: '#fff' }}
                                    formatter={(value, name) => {
                                        if (name === "sales") return [`¥${value.toLocaleString()}`, "売上高"];
                                        if (name === "count") return [`${value.toLocaleString()} 件`, "案件数"];
                                        return [value, name];
                                    }}
                                />
                                <Area yAxisId="left" type="monotone" dataKey="sales" name="sales" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                                <Area yAxisId="right" type="monotone" dataKey="count" name="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status Distribution - 1/3 width */}
                <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700 backdrop-blur-md flex flex-col h-[380px]">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-amber-900/30 text-amber-400 rounded-lg">
                            <PieChart size={20} />
                        </div>
                        <h3 className="font-bold text-slate-200">案件ステータス分布</h3>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center min-h-0">
                        <div className="w-full h-[200px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsPieChart>
                                    <Pie
                                        data={analysisData.pieData}
                                        innerRadius={60}
                                        outerRadius={85}
                                        paddingAngle={8}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {analysisData.pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                                        itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                                    />
                                </RechartsPieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-3 gap-2 w-full mt-6 border-t border-slate-700/50 pt-6 text-center">
                            {analysisData.pieData.map((d, i) => (
                                <div key={i}>
                                    <div className="text-base font-black text-white">{d.value}</div>
                                    <div className="text-[8px] text-slate-500 uppercase font-bold tracking-wider">{d.name}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Detailed Analysis Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Processing Cost Performance */}
                <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700 backdrop-blur-md relative overflow-hidden group min-h-[340px] flex flex-col">
                    {!isPro && <AnalysisLockOverlay title="予実管理分析" />}
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-purple-900/30 text-purple-400 rounded-lg">
                            <BarChart3 size={20} />
                        </div>
                        <h3 className="font-bold text-slate-200">加工費 予実管理分析</h3>
                    </div>
                    <div className="flex-1 flex flex-col justify-center gap-6">
                        {analysisData.procPerformance.itemsWithActuals > 0 ? (() => {
                            const p = analysisData.procPerformance;
                            const pWidth = p.totalActual > p.totalPlan ? (p.totalPlan / p.totalActual * 100) : 100;
                            const aWidth = p.totalActual > p.totalPlan ? 100 : (p.totalPlan > 0 ? (p.totalActual / p.totalPlan * 100) : 0);
                            
                            return (
                                <>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-bold text-slate-500 px-1">
                                            <span>予定加工費 (合計)</span>
                                            <span>¥{p.totalPlan.toLocaleString()}</span>
                                        </div>
                                        <div className="w-full h-4 bg-slate-900 rounded-full border border-slate-700 overflow-hidden">
                                            <div className="bg-blue-600/50 h-full transition-all" style={{ width: `${pWidth}%` }} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-bold text-slate-500 px-1">
                                            <span>実績加工費 (合計)</span>
                                            <span>¥{p.totalActual.toLocaleString()}</span>
                                        </div>
                                        <div className="w-full h-4 bg-slate-900 rounded-full border border-slate-700 overflow-hidden text-right">
                                            <div 
                                                className={`${p.diff >= 0 ? 'bg-emerald-500' : 'bg-red-500'} h-full transition-all`} 
                                                style={{ width: `${aWidth}%` }} 
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-2 pt-4 border-t border-slate-700/50">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-slate-500">改善効率 (工賃利益率)</span>
                                            <span className={`text-2xl font-black ${p.diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {p.diff >= 0 ? '+' : ''}{p.efficiency}%
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-bold text-slate-500">利益額(改善分)</span>
                                            <div className={`text-sm font-black ${p.diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {p.diff >= 0 ? '¥' : '-¥'}{Math.abs(p.diff).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            );
                        })() : (
                            <div className="text-center text-slate-500 italic py-10">
                                実績データ（工数または工賃）が入力された<br/>案件がまだありません
                            </div>
                        )}
                    </div>
                </div>

                {/* Top Companies */}
                <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700 backdrop-blur-md flex flex-col min-h-[340px]">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-blue-900/30 text-blue-400 rounded-lg">
                            <Users size={20} />
                        </div>
                        <h3 className="font-bold text-slate-200">主要取引先分析</h3>
                    </div>
                    <div className="flex-1 space-y-3">
                        {analysisData.topCompanies.length > 0 ? analysisData.topCompanies.map((c, i) => (
                            <div key={c.name} className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-600 transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-6 h-6 shrink-0 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500 border border-slate-700">
                                        {i + 1}
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className="text-xs font-bold text-slate-200 truncate">{c.name}</div>
                                        <div className="text-[10px] text-slate-500">受注率: {c.winRate}% ({c.ordered}/{stats?.companyStats?.[c.name]?.total || c.total}件)</div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-xs font-black text-slate-100">¥{(c.amount / 10000).toFixed(1)}万</div>
                                    <div className="text-[10px] text-slate-500 font-medium">{c.ordered}件受注</div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-10 text-slate-500 italic">取引先データがありません</div>
                        )}
                    </div>
                </div>
            </div>

            {/* 4. Profitability Ranking */}
            <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700 backdrop-blur-md relative overflow-hidden">
                {!isPro && <AnalysisLockOverlay title="収益性・ランキング詳細" />}
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-emerald-900/30 text-emerald-400 rounded-lg">
                        <Award size={20} />
                    </div>
                    <h3 className="font-bold text-slate-200">収益性ランキング (利益率順)</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-slate-500 border-b border-slate-700">
                                <th className="text-left font-bold py-3 pl-2 text-[10px] uppercase tracking-wider">案件 / 顧客</th>
                                <th className="text-right font-bold py-3 text-[10px] uppercase tracking-wider">加工費額</th>
                                <th className="text-right font-bold py-3 text-[10px] uppercase tracking-wider">実績加工費</th>
                                <th className="text-right font-bold py-3 pr-2 text-[10px] uppercase tracking-wider">利益率(工賃)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {analysisData.profitability.slice(0, 10).map((p) => (
                                <tr
                                    key={p.id}
                                    className={cn(
                                        "transition-colors group",
                                        isPro ? "hover:bg-slate-700/50 cursor-pointer" : "cursor-default opacity-50 grayscale"
                                    )}
                                    onClick={() => isPro && setSelectedId(p.id)}
                                >
                                    <td className="py-3 pl-2">
                                        <div className="font-bold text-slate-200 truncate max-w-[200px] group-hover:text-blue-400 transition-colors">{p.subject || '無題'}</div>
                                        <div className="text-[10px] text-slate-500 truncate max-w-[200px]">{p.company}</div>
                                    </td>
                                    <td className="text-right py-3 font-medium text-slate-400 italic">¥{p.estProcTotal.toLocaleString()}</td>
                                    <td className="text-right py-3 font-medium text-slate-400">¥{p.actProcTotal.toLocaleString()}</td>
                                    <td className="text-right py-3 pr-2">
                                        <div className={`inline-flex items-center gap-0.5 font-black ${p.marginPct >= 30 ? 'text-emerald-400' : p.marginPct >= 10 ? 'text-blue-400' : p.marginPct >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                                            {p.marginPct > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                            {p.marginPct.toFixed(1)}%
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {analysisData.profitability.length === 0 && (
                        <div className="text-center py-10 text-slate-500 italic">
                            実績データが入力された受注案件がまだありません
                        </div>
                    )}
                </div>
            </div>

            {/* Detail Modal */}
            {selectedId && (() => {
                const q = quotations.find(item => item.id === selectedId);
                if (!q) return null;
                return (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedId(null)}>
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>

                            {/* Modal Header */}
                            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
                                <div>
                                    <h4 className="text-xl font-black text-white">{q.companyName}</h4>
                                    <p className="text-sm text-slate-400 font-medium">案件詳細・コスト分析</p>
                                </div>
                                <button onClick={() => setSelectedId(null)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                                    <X size={24} className="text-slate-500" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="p-6 overflow-y-auto flex-1">
                                <div className="space-y-6">
                                    {/* Basic Info */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700 text-sm">
                                        <div className="space-y-2.5">
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <User size={16} className="text-slate-500 shrink-0" />
                                                <span className="font-bold">{q.contactPerson || '(担当者未設定)'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <Mail size={16} className="text-slate-500 shrink-0" />
                                                <span className="text-slate-500">-</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-500 pt-1">
                                                <Calendar size={14} className="shrink-0" />
                                                <span className="text-xs font-medium">登録日: {new Date(q.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Items List */}
                                    <div className="space-y-4">
                                        <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">案件明細・コスト分析</h5>
                                        {(q.items || []).map((item, idx) => {
                                            const qty = Number(item.quantity) || 1;
                                            return (
                                                <div key={idx} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-lg bg-indigo-900/30 text-indigo-400 flex items-center justify-center font-black text-sm">
                                                                {idx + 1}
                                                            </div>
                                                            <span className="font-black text-slate-200 text-base">{item.name || '未命名項目'}</span>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] font-black text-slate-600 uppercase">数量</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-black text-slate-400">{qty.toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                        <div className="p-2 bg-blue-900/10 rounded-lg">
                                                            <div className="text-[8px] font-black text-blue-500 uppercase tracking-tight mb-0.5">予定 加工費</div>
                                                            <div className="text-xs font-black text-blue-400">¥{((Number(item.processingCost) || 0) * qty).toLocaleString()}</div>
                                                        </div>
                                                        <div className="p-2 bg-emerald-900/10 rounded-lg">
                                                            <div className="text-[8px] font-black text-emerald-500 uppercase tracking-tight mb-0.5">予定 材料費</div>
                                                            <div className="text-xs font-black text-emerald-400">¥{((Number(item.materialCost) || 0) * qty).toLocaleString()}</div>
                                                        </div>
                                                        <div className="p-2 bg-blue-900/10 rounded-lg border border-blue-900/30">
                                                            <div className="text-[8px] font-black text-blue-500 uppercase tracking-tight mb-0.5">実績 加工費</div>
                                                            <div className="text-xs font-black text-blue-200">{item.actualProcessingCost ? `¥${(Number(item.actualProcessingCost) * qty).toLocaleString()}` : '未'}</div>
                                                        </div>
                                                        <div className="p-2 bg-emerald-900/10 rounded-lg border border-emerald-900/30">
                                                            <div className="text-[8px] font-black text-emerald-500 uppercase tracking-tight mb-0.5">実績 材料費</div>
                                                            <div className="text-xs font-black text-emerald-200">{item.actualMaterialCost ? `¥${(Number(item.actualMaterialCost) * qty).toLocaleString()}` : '未'}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end">
                                <button onClick={() => setSelectedId(null)} className="px-8 py-2.5 bg-slate-700 text-white rounded-xl font-black text-sm transition-all hover:bg-slate-600">
                                    閉じる
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
