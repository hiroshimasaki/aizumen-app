import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import AnalysisView from '../components/AnalysisView';
import DashboardMetrics from '../components/DashboardMetrics';
import { BarChart3, Lock, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

export default function AnalysisPage() {
    const { tenant } = useAuth();
    const [allQuotations, setAllQuotations] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filterPeriod, setFilterPeriod] = useState('current');

    const isPro = tenant?.plan === 'pro';

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [statsRes, quotationsRes] = await Promise.all([
                    api.get('/api/quotations/stats'),
                    api.get('/api/quotations?limit=1000')
                ]);

                setStats(statsRes.data);

                const mapped = (quotationsRes.data.data || []).map(q => ({
                    id: q.id,
                    companyName: q.company_name,
                    contactPerson: q.contact_person,
                    status: q.status,
                    createdAt: q.created_at,
                    items: (q.quotation_items || []).map(item => ({
                        id: item.id,
                        name: item.name,
                        quantity: item.quantity,
                        processingCost: item.processing_cost,
                        materialCost: item.material_cost,
                        otherCost: item.other_cost,
                        dueDate: item.due_date,
                        deliveryDate: item.delivery_date,
                        actualHours: item.actual_hours,
                        actualProcessingCost: item.actual_processing_cost,
                        actualMaterialCost: item.actual_material_cost,
                        actualOtherCost: item.actual_other_cost,
                    })),
                    files: (q.quotation_files || []).map(f => ({
                        id: f.id,
                        originalName: f.original_name,
                    })),
                }));
                setAllQuotations(mapped);
            } catch (err) {
                console.error('Failed to fetch data for analysis:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchAll();

        // リアルタイム更新の購読
        if (!tenant?.id) return;

        const channel = supabase.channel(`analysis_changes_${tenant.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'quotations',
                    filter: `tenant_id=eq.${tenant.id}`
                },
                () => fetchAll()
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'quotation_items',
                    filter: `tenant_id=eq.${tenant.id}`
                },
                () => fetchAll()
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [isPro, tenant?.id]);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-900/30 text-indigo-400 rounded-xl">
                    <BarChart3 size={28} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-white">データ分析</h1>
                    <p className="text-slate-400 text-sm">受注・収益の分析ダッシュボード</p>
                </div>
                <div className="flex-1 flex justify-end gap-3">
                    <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-1 flex gap-1 shadow-lg h-fit">
                        <button
                            onClick={() => setFilterPeriod('current')}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-[10px] font-black transition-all",
                                filterPeriod === 'current' ? "bg-indigo-600 text-white shadow-indigo-500/20 shadow-lg" : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            今月
                        </button>
                        <button
                            onClick={() => setFilterPeriod('3months')}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-[10px] font-black transition-all",
                                filterPeriod === '3months' ? "bg-indigo-600 text-white shadow-indigo-500/20 shadow-lg" : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            過去3ヶ月
                        </button>
                        <button
                            onClick={() => setFilterPeriod('6months')}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-[10px] font-black transition-all",
                                filterPeriod === '6months' ? "bg-indigo-600 text-white shadow-indigo-500/20 shadow-lg" : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            過去6ヶ月
                        </button>
                        <button
                            onClick={() => setFilterPeriod('1year')}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-[10px] font-black transition-all",
                                filterPeriod === '1year' ? "bg-indigo-600 text-white shadow-indigo-500/20 shadow-lg" : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            過去1年
                        </button>
                    </div>
                    <button
                        onClick={() => { setLoading(true); }} // This will trigger fetch via effect if we use a trigger state, but for now simple refresh is fine
                        className="p-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-all"
                    >
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Stats Summary Cards */}
            <DashboardMetrics stats={stats} filterMonth={filterPeriod} />

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                    <p className="animate-pulse">データを読み込み中...</p>
                </div>
            ) : (
                <AnalysisView 
                    quotations={allQuotations} 
                    stats={stats}
                    isPro={isPro}
                />
            )}
        </div>
    );
}
