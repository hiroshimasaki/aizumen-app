import { useState, useEffect } from 'react';
import { Sparkles, Lock, ChevronRight, AlertCircle, LayoutDashboard, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import api from '../lib/api';
import { cn } from '../lib/utils';

export default function AIMonthlyReport({ defaultMonth, isPro: isProProp = true }) {
    const [targetMonth, setTargetMonth] = useState(defaultMonth);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isPro, setIsPro] = useState(isProProp);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        setIsPro(isProProp);
    }, [isProProp]);

    useEffect(() => {
        fetchReport();
        // Reset expanded state when month changes to allow user to decide to open it
        setIsExpanded(false);
    }, [targetMonth]);

    const fetchReport = async () => {
        if (!isPro) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get(`/api/analysis/ai-monthly-report?targetMonth=${targetMonth}`);
            setReport(data.report);
            setIsPro(data.isPro);
        } catch (err) {
            if (err.response?.status === 403) {
                setIsPro(false);
            } else {
                setError('レポートの取得に失敗しました。');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleMonthChange = (e) => {
        setTargetMonth(e.target.value);
    };

    // 生成可能な過去6ヶ月分のリストを作成
    const monthOptions = Array.from({ length: 6 }).map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i); // 当月含む過去6ヶ月
        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return val;
    });

    if (!isPro) {
        return (
            <div className="relative group overflow-hidden bg-slate-900 border border-slate-700/50 rounded-2xl p-8 text-center luxury-shadow animate-in fade-in duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />
                <div className="relative z-10">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center border border-white/5 shadow-inner">
                            <Lock className="text-amber-400" size={32} />
                        </div>
                        <select 
                            value={targetMonth} 
                            onChange={handleMonthChange}
                            className="bg-slate-800 border border-slate-700 text-slate-400 text-xs py-1 px-2 rounded-lg outline-none"
                        >
                            {monthOptions.map(m => (
                                <option key={m} value={m}>{m.replace('-', '年')}月</option>
                            ))}
                        </select>
                    </div>
                    <h3 className="text-xl font-black text-white mb-2 flex items-center justify-center gap-2">
                        <Sparkles className="text-amber-400 shrink-0" size={20} />
                        AI月次経営総評
                    </h3>
                    <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto leading-relaxed">
                        Proプラン限定の機能です。AIが毎月の実績を分析し、経営改善のヒントや現場へのアドバイスを自動生成します。
                    </p>
                    <Link 
                        to="/admin?tab=billing" 
                        className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 border border-white/10"
                    >
                        Proプランの詳細を見る
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/80 rounded-2xl border border-slate-700 overflow-hidden luxury-shadow transition-all hover:border-slate-600 animate-in fade-in duration-700">
            <div 
                className="bg-gradient-to-r from-indigo-900/40 via-purple-900/20 to-transparent p-6 border-b border-slate-700 cursor-pointer select-none hover:from-indigo-900/50 transition-all"
                onClick={() => report && setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-500/30 text-indigo-400">
                            <Sparkles size={22} className="animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-black text-white tracking-tight">AI 経営・現場分析レポート</h3>
                                <select 
                                    value={targetMonth} 
                                    onChange={handleMonthChange}
                                    onClick={(e) => e.stopPropagation()}
                                    className="bg-slate-900/80 border border-slate-700 text-slate-300 text-[10px] font-bold py-1 px-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer hover:bg-slate-800 transition-colors"
                                >
                                    {monthOptions.map(m => (
                                        <option key={m} value={m}>{m.replace('-', '年')}月</option>
                                    ))}
                                </select>
                            </div>
                            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">{targetMonth} 度の総括</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            <span className="text-[10px] font-black text-slate-300">GENERATED BY GEMINI 1.5</span>
                        </div>
                        {report && (
                            <div className={cn("text-slate-500 transition-transform duration-300", isExpanded && "rotate-90")}>
                                <ChevronRight size={24} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <div className={cn(
                "overflow-hidden transition-all duration-500 ease-in-out",
                isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
            )}>
                <div className="p-8 min-h-[200px] flex flex-col justify-center border-b border-slate-700/50">
                    {loading ? (
                        <div className="animate-pulse space-y-4">
                            <div className="h-4 w-full bg-slate-700/50 rounded" />
                            <div className="h-4 w-[90%] bg-slate-700/50 rounded" />
                            <div className="h-4 w-[95%] bg-slate-700/50 rounded" />
                        </div>
                    ) : error || !report ? (
                        <div className="text-center py-4">
                            <MessageSquare className="text-slate-600 mx-auto mb-3" size={32} />
                            <h3 className="text-slate-300 font-bold mb-1">{targetMonth} 分の分析データはありません</h3>
                            <p className="text-slate-500 text-xs text-balance">翌月1日の深夜に自動生成されます。</p>
                        </div>
                    ) : (
                        <div className="prose prose-invert prose-sm max-w-none 
                            prose-headings:text-white prose-headings:font-black prose-headings:tracking-tight prose-headings:border-l-4 prose-headings:border-indigo-500 prose-headings:pl-3 prose-headings:mb-4
                            prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-6
                            prose-li:text-slate-300 prose-li:mb-2
                            prose-strong:text-indigo-300 prose-strong:font-black
                            prose-code:text-emerald-400 prose-code:bg-slate-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                            prose-blockquote:border-l-slate-700 prose-blockquote:text-slate-400 prose-blockquote:italic
                        ">
                            <ReactMarkdown>{report.content}</ReactMarkdown>
                        </div>
                    )}
                </div>

                {report && (
                    <div className="px-8 py-4 bg-slate-900/50 flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex -space-x-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="w-6 h-6 rounded-full border-2 border-slate-800 bg-slate-700 flex items-center justify-center overflow-hidden">
                                        <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-800" />
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] font-medium text-slate-500 italic">このレポートは Vertex AI (Gemini) によって安全に生成されました。</p>
                        </div>
                        <div className="text-[10px] font-black text-slate-600 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
                            REF: {report.id.substring(0, 8).toUpperCase()}
                        </div>
                    </div>
                )}
            </div>

            {/* Collapsed view indicator when report exists and is not expanded */}
            {!isExpanded && report && !loading && (
                <div className="bg-slate-900/30 px-8 py-2 text-center border-t border-slate-700/50">
                    <button 
                        onClick={() => setIsExpanded(true)}
                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center justify-center gap-1 mx-auto"
                    >
                        レポートの詳細を展開
                        <ChevronRight size={12} className="rotate-90" />
                    </button>
                </div>
            )}
        </div>
    );
}
