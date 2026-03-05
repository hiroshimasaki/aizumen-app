import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BarChart3, RefreshCw, X } from 'lucide-react';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import ScheduleGantt from '../components/ScheduleGantt';
import QuotationForm from '../components/QuotationForm';

export default function DashboardPage() {
    const { isAdmin, tenant } = useAuth();

    const [quotations, setQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingData, setEditingData] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch for dashboard visibility (recent/active records)
            const { data: qData } = await api.get('/api/quotations?limit=200');

            const mapQuote = (q) => ({
                id: q.id,
                displayId: q.display_id,
                companyName: q.company_name,
                contactPerson: q.contact_person,
                status: q.status,
                createdAt: q.created_at,
                files: (q.quotation_files || []).map(f => ({
                    id: f.id,
                    originalName: f.original_name,
                })),
                sourceFiles: (q.quotation_source_files || []).map(sf => ({
                    sourceFileId: sf.source_file_id,
                    originalName: sf.original_name,
                })),
                items: (q.quotation_items || []).map(item => ({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    processingCost: item.processing_cost,
                    materialCost: item.material_cost,
                    otherCost: item.other_cost,
                    dueDate: item.due_date,
                    deliveryDate: item.delivery_date,
                    scheduledStartDate: item.scheduled_start_date,
                    actualHours: item.actual_hours,
                    actualProcessingCost: item.actual_processing_cost,
                }))
            });

            setQuotations(qData.data.map(mapQuote));
        } catch (err) {
            console.error('ダッシュボードデータの取得に失敗しました:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        if (!tenant?.id) return;

        const channel = supabase.channel(`dashboard_changes_${tenant.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'quotations',
                    filter: `tenant_id=eq.${tenant.id}`
                },
                () => fetchData()
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'quotation_items',
                    filter: `tenant_id=eq.${tenant.id}`
                },
                () => fetchData()
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [tenant?.id]);

    const handleEdit = (quotation) => {
        setEditingData(quotation);
        setIsFormOpen(true);
    };

    const handleFormSubmit = () => {
        setIsFormOpen(false);
        setEditingData(null);
        fetchData();
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex justify-between items-center mb-2">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <BarChart3 className="text-indigo-400" size={32} />
                        ガントチャート
                    </h1>
                    <p className="text-slate-500 font-bold mt-1 uppercase tracking-widest text-[10px]">生産・スケジュール概要</p>
                </div>
                <button
                    onClick={fetchData}
                    className="p-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-slate-400 hover:text-white transition-all hover:scale-105 active:scale-95"
                >
                    <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Gantt Chart Section - Main Focus */}
            <div className="relative">
                <ScheduleGantt
                    quotations={quotations}
                    onEdit={handleEdit}
                    onRefresh={fetchData}
                    isAdmin={isAdmin}
                />
            </div>

            {/* Editing Modal Overlay */}
            {isFormOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
                    <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                            <h2 className="text-xl font-black text-white">案件の編集</h2>
                            <button onClick={() => setIsFormOpen(false)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                            <QuotationForm
                                initialData={editingData}
                                onSubmit={handleFormSubmit}
                                onCancel={() => setIsFormOpen(false)}
                                isAdmin={isAdmin}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
