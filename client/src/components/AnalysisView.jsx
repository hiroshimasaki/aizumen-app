import { useState, useMemo, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, PieChart, ArrowUpRight, ArrowDownRight, Award, X, User, Mail, StickyNote, FileText, Calendar, Link as LinkIcon, DownloadCloud } from 'lucide-react';
import api from '../lib/api';
import AIMonthlyReport from './AIMonthlyReport';

export default function AnalysisView({ quotations, period = 'all', hourlyRate = 8000 }) {
    const [selectedId, setSelectedId] = useState(null);

    // Helper function for percentage calculation
    function pctSafe(val, total) {
        if (!total || total <= 0) return 0;
        return Math.round((val / total) * 100);
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

        // 1. Monthly Revenue Trend (Last 6 months, always shows 6 months for trend)
        const monthlyRevenue = {};
        for (let i = 0; i < 6; i++) {
            const d = new Date(currentYear, currentMonth - i, 1);
            const mStr = String(d.getMonth() + 1).padStart(2, '0');
            const key = `${d.getFullYear()}/${mStr}`;
            monthlyRevenue[key] = { proc: 0, mat: 0, other: 0, total: 0 };
        }

        quotations.filter(q => validStatuses.includes(q.status)).forEach(q => {
            (q.items || []).forEach(item => {
                const d = item.deliveryDate ? new Date(item.deliveryDate) : (q.createdAt ? new Date(q.createdAt) : null);
                if (!d || isNaN(d.getTime())) return;
                const mStr = String(d.getMonth() + 1).padStart(2, '0');
                const key = `${d.getFullYear()}/${mStr}`;
                if (monthlyRevenue.hasOwnProperty(key)) {
                    const qty = Number(item.quantity) || 1;
                    const p = (Number(item.processingCost) || 0) * qty;
                    const m = (Number(item.materialCost) || 0) * qty;
                    const o = (Number(item.otherCost) || 0) * qty;
                    monthlyRevenue[key].proc += p;
                    monthlyRevenue[key].mat += m;
                    monthlyRevenue[key].other += o;
                    monthlyRevenue[key].total += (p + m + o);
                }
            });
        });

        const trendData = Object.entries(monthlyRevenue)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, data]) => ({ month, ...data, amount: data.total }));

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
                    return sum + (cost * (Number(item.quantity) || 1));
                }, 0);
                companyStats[name].amount += amount;
            }
        });

        const topCompanies = Object.entries(companyStats)
            .map(([name, stats]) => ({ name, ...stats, winRate: Math.round((stats.ordered / stats.total) * 100) }))
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
                    actualVal = Number(item.actualProcessingCost) * qty;
                    hasActual = true;
                } else if (item.actualHours && Number(item.actualHours) > 0) {
                    actualVal = Number(item.actualHours) * hourlyRate;
                    hasActual = true;
                }

                if (hasActual) {
                    totalPlan += (Number(item.processingCost) || 0) * qty;
                    totalActual += actualVal;
                    itemsWithActuals++;
                }
            });
        });

        return { 
            trendData, 
            profitability, 
            topCompanies, 
            procPerformance: { 
                totalPlan, 
                totalActual, 
                itemsWithActuals,
                diff: totalPlan - totalActual,
                efficiency: totalPlan > 0 ? Math.round(((totalPlan - totalActual) / totalPlan) * 100) : 0
            } 
        };
    }, [quotations, period, hourlyRate]);

    const { maxRevenue, ticks } = useMemo(() => {
        const rawMax = Math.max(...analysisData.trendData.map(d => d.amount), 0);
        if (rawMax === 0) return { maxRevenue: 100000, ticks: [0, 50000, 100000] };

        const power = Math.floor(Math.log10(rawMax));
        const magnitude = Math.pow(10, power);
        const factor = rawMax / magnitude;
        let niceFactor;
        if (factor <= 1) niceFactor = 1;
        else if (factor <= 2) niceFactor = 2;
        else if (factor <= 5) niceFactor = 5;
        else niceFactor = 10;

        const niceMax = niceFactor * magnitude;
        const tickCount = niceFactor === 1 ? 5 : niceFactor === 2 ? 4 : 5;
        const interval = niceMax / tickCount;
        const t = [];
        for (let i = 0; i <= tickCount; i++) t.push(interval * i);
        return { maxRevenue: niceMax, ticks: t.reverse() };
    }, [analysisData.trendData]);


    const reportMonth = useMemo(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }, []);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* AI Analysis Section */}
            <AIMonthlyReport defaultMonth={reportMonth} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Monthly Revenue Trend */}
                <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700 backdrop-blur-md">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-blue-900/30 text-blue-400 rounded-lg">
                            <TrendingUp size={20} />
                        </div>
                        <h3 className="font-bold text-slate-200">月別売上推移 (直近6ヶ月)</h3>
                    </div>
                    <div className="h-48 flex items-end gap-3 px-2 relative">
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pr-8">
                            {ticks.map((tick, i) => (
                                <div key={i} className="w-full flex items-center gap-2">
                                    <div className="flex-1 border-t border-slate-700 border-dashed" />
                                    <span className="text-[9px] font-bold text-slate-600 min-w-[32px] text-right">
                                        {tick >= 10000 ? `${(tick / 10000).toFixed(0)}万` : tick.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                        {analysisData.trendData.map((d) => (
                            <div key={d.month} className="flex-1 flex flex-col items-center gap-2 group z-10 relative">
                                <div className="w-full relative flex flex-col justify-end h-40">
                                    <div className="w-full flex flex-col justify-end h-full">
                                        <div className="w-full bg-amber-500 group-hover:bg-amber-400 transition-all cursor-help" style={{ height: `${(d.other / maxRevenue) * 100}%` }} />
                                        <div className="w-full bg-emerald-500 group-hover:bg-emerald-400 transition-all cursor-help" style={{ height: `${(d.mat / maxRevenue) * 100}%` }} />
                                        <div className="w-full bg-blue-500 group-hover:bg-blue-400 rounded-t-sm transition-all cursor-help" style={{ height: `${(d.proc / maxRevenue) * 100}%` }} />
                                    </div>
                                    <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-950 text-white text-[10px] py-2 px-3 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none border border-slate-700">
                                        <div className="font-bold border-b border-slate-700 mb-1 pb-1">{d.month}</div>
                                        <div className="flex justify-between gap-4"><span>加工:</span> <span>¥{d.proc.toLocaleString()}</span></div>
                                        <div className="flex justify-between gap-4 text-emerald-400"><span>材料:</span> <span>¥{d.mat.toLocaleString()}</span></div>
                                        <div className="flex justify-between gap-4 text-slate-400"><span>合計:</span> <span className="font-bold">¥{d.amount.toLocaleString()}</span></div>
                                    </div>
                                </div>
                                <span className="text-[10px] text-slate-500 font-medium mt-1">{d.month.split('/')[1]}月</span>
                            </div>
                        ))}
                    </div>
                    {/* Legend */}
                    <div className="flex justify-center gap-6 mt-4 text-[10px] font-bold text-slate-500">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />加工費</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />材料費</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />その他</span>
                    </div>
                </div>

                {/* Processing Cost Plan vs Actual */}
                <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700 backdrop-blur-md">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-purple-900/30 text-purple-400 rounded-lg">
                            <PieChart size={20} />
                        </div>
                        <h3 className="font-bold text-slate-200">加工費 予実管理分析</h3>
                    </div>
                    <div className="flex flex-col h-48 justify-center gap-4">
                        {analysisData.procPerformance.itemsWithActuals > 0 ? (
                            <>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-500 px-1">
                                        <span>予定加工費 (合計)</span>
                                        <span>¥{analysisData.procPerformance.totalPlan.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full h-4 bg-slate-900 rounded-full border border-slate-700 overflow-hidden">
                                        <div className="bg-blue-600/50 h-full transition-all" style={{ width: '100%' }} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-500 px-1">
                                        <span>実績加工費 (合計)</span>
                                        <span>¥{analysisData.procPerformance.totalActual.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full h-4 bg-slate-900 rounded-full border border-slate-700 overflow-hidden">
                                        <div 
                                            className={`${analysisData.procPerformance.diff >= 0 ? 'bg-emerald-500' : 'bg-red-500'} h-full transition-all`} 
                                            style={{ width: `${Math.min(100, (analysisData.procPerformance.totalActual / analysisData.procPerformance.totalPlan) * 100)}%` }} 
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/50">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-500">改善効率 (工賃利益率)</span>
                                        <span className={`text-xl font-black ${analysisData.procPerformance.diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {analysisData.procPerformance.diff >= 0 ? '+' : ''}{analysisData.procPerformance.efficiency}%
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-bold text-slate-500">利益額(改善分)</span>
                                        <div className={`text-sm font-black ${analysisData.procPerformance.diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {analysisData.procPerformance.diff >= 0 ? '¥' : '-¥'}{Math.abs(analysisData.procPerformance.diff).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-center text-slate-500 italic py-10">
                                実績データ（工数または工賃）が入力された<br/>案件がまだありません
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Companies */}
                <div className="lg:col-span-1 bg-slate-800/80 p-6 rounded-2xl border border-slate-700 backdrop-blur-md">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-amber-900/30 text-amber-400 rounded-lg">
                            <Users size={20} />
                        </div>
                        <h3 className="font-bold text-slate-200">主要取引先分析</h3>
                    </div>
                    <div className="space-y-3">
                        {analysisData.topCompanies.length > 0 ? analysisData.topCompanies.map((c, i) => (
                            <div key={c.name} className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-600 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500 border border-slate-700">
                                        {i + 1}
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-200 truncate max-w-[120px]">{c.name}</div>
                                        <div className="text-[10px] text-slate-500">受注率: {c.winRate}% ({c.ordered}/{c.total}件)</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-black text-slate-100">¥{(c.amount / 10000).toFixed(1)}万</div>
                                    <div className="text-[10px] text-slate-500 font-medium">{c.ordered}件受注</div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-10 text-slate-500 italic">取引先データがありません</div>
                        )}
                    </div>
                </div>

                {/* Profitability Ranking */}
                <div className="lg:col-span-2 bg-slate-800/80 p-6 rounded-2xl border border-slate-700 backdrop-blur-md">
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
                                        className="hover:bg-slate-700/50 transition-colors cursor-pointer group"
                                        onClick={() => setSelectedId(p.id)}
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
                                                {Math.round(p.marginPct)}%
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
                                                {q.emailLink ? (
                                                    <a href={q.emailLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline truncate">メールを確認する</a>
                                                ) : <span className="text-slate-500">-</span>}
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-500 pt-1">
                                                <Calendar size={14} className="shrink-0" />
                                                <span className="text-xs font-medium">登録日: {new Date(q.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        {q.notes && (
                                            <div className="p-3 bg-amber-900/10 rounded-lg border border-amber-900/20 text-slate-400 text-xs">
                                                <div className="flex items-center gap-1.5 mb-1.5 text-amber-400 font-black">
                                                    <StickyNote size={14} /><span>備考メモ</span>
                                                </div>
                                                <p className="whitespace-pre-wrap leading-relaxed">{q.notes}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Files */}
                                    {q.files?.length > 0 && (
                                        <div className="space-y-3">
                                            <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                                                <FileText size={12} /> 関連ファイル
                                            </h5>
                                            <div className="flex flex-wrap gap-2">
                                                {q.files.map((f) => (
                                                    <button
                                                        key={f.id}
                                                        onClick={async (e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            try {
                                                                const { data } = await api.get(`/api/files/${f.id}`);
                                                                if (data?.url) window.open(data.url, '_blank');
                                                            } catch (err) {
                                                                console.error('File download failed:', err);
                                                            }
                                                        }}
                                                        className="group flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300 hover:border-blue-500 hover:shadow-md transition-all"
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-500 group-hover:bg-blue-900/30 group-hover:text-blue-400 transition-colors">
                                                            <FileText size={16} />
                                                        </div>
                                                        <div className="flex flex-col text-left">
                                                            <span className="font-bold truncate max-w-[140px]">{f.originalName || f.original_name}</span>
                                                            <span className="text-[8px] text-slate-500 flex items-center gap-0.5 uppercase tracking-tighter">
                                                                <DownloadCloud size={8} /> Download
                                                            </span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

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
                                                                {item.dimensions && (
                                                                    <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded border border-slate-600">
                                                                        {item.dimensions}
                                                                    </span>
                                                                )}
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

                                                    {item.actualProcessingCost > 0 && (
                                                        <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
                                                            <span className="text-xs font-black text-slate-500 flex items-center gap-1.5">
                                                                <Award size={14} className={((Number(item.processingCost) - Number(item.actualProcessingCost)) >= 0) ? 'text-emerald-500' : 'text-red-400'} />
                                                                加工利益 (ロット合計)
                                                            </span>
                                                            <div className="text-right">
                                                                <span className={`text-lg font-black ${(Number(item.processingCost) - Number(item.actualProcessingCost)) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                    {(Number(item.processingCost) - Number(item.actualProcessingCost)) >= 0 ? '+' : ''}
                                                                    {((Number(item.processingCost) - Number(item.actualProcessingCost)) * qty).toLocaleString()} <span className="text-xs ml-0.5">円</span>
                                                                </span>
                                                                <div className="text-[9px] font-bold text-slate-500">材料費除く純利益</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end">
                                <button
                                    onClick={() => setSelectedId(null)}
                                    className="px-8 py-2.5 bg-slate-700 text-white rounded-xl font-black text-sm shadow-lg active:scale-95 transition-all hover:bg-slate-600"
                                >
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
