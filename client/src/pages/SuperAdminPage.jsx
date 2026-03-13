import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Users,
    Building2,
    Search,
    ArrowRight,
    Activity,
    Cpu,
    Clock,
    UserPlus,
    CreditCard as BillingIcon,
    AlertCircle,
    Zap,
    TrendingUp,
    Terminal,
    LayoutDashboard,
    Power,
    MessageSquareMore
} from 'lucide-react';
import api from '../lib/api';
import { cn } from '../lib/utils';
import SuperAdminLogs from '../components/admin/SuperAdminLogs';

/**
 * Super Admin (サービス管理者) 専用ダッシュボード
 * スタイリッシュさと視認性を両立させた Apple HIG 準拠デザイン
 */
export default function SuperAdminPage() {
    const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' or 'logs'
    const [stats, setStats] = useState(null);
    const [tenants, setTenants] = useState([]);
    const [health, setHealth] = useState({ db: 'loading', storage: 'loading', ai: 'loading' });
    const [activities, setActivities] = useState([]);
    const [usage, setUsage] = useState({ storage: [], ai: [], totals: { storage: 0, ai: 0, db: 0 }, storageLimit: 1 * 1024 * 1024 * 1024, dbLimit: 500 * 1024 * 1024 });
    const [billing, setBilling] = useState({ mrr: 0, activeCount: 0, alerts: [] });
    const [pendingReportsCount, setPendingReportsCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPlan, setFilterPlan] = useState('all');
    const [lastUpdated, setLastUpdated] = useState(new Date());

    // Maintenance Mode States
    const [maintenanceSettings, setMaintenanceSettings] = useState({ enabled: false, message: '' });
    const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
    const [maintenanceForm, setMaintenanceForm] = useState({ enabled: false, message: '' });
    const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);

    // 単位変換ヘルパー (Byte -> MB/GB)
    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 MB';
        const mb = bytes / (1024 * 1024);
        if (mb >= 1000) return `${(mb / 1024).toFixed(1)} GB`;
        return `${mb.toFixed(1)} MB`;
    };

    const getStorageLimitGB = (tenant) => {
        // APIから返却された上限値がある場合はそれを使用（stripe.jsの最新値）
        if (tenant?.maxStorageGB) return tenant.maxStorageGB;

        // フォールバック（念のため）
        const limits = { free: 1, lite: 5, plus: 20, pro: 100 };
        return limits[tenant?.plan?.toLowerCase()] || 1;
    };

    const REFRESH_INTERVAL = 60000; // 60秒

    useEffect(() => {
        fetchData();
        const interval = setInterval(() => {
            fetchData(true);
        }, REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [statsRes, tenantsRes, healthRes, activitiesRes, usageRes, billingRes, pendingRes, maintenanceRes] = await Promise.all([
                api.get('/api/super-admin/stats'),
                api.get('/api/super-admin/tenants'),
                api.get('/api/super-admin/health').catch(() => ({ data: { db: 'error', storage: 'error', ai: 'error' } })),
                api.get('/api/super-admin/activities').catch(() => ({ data: [] })),
                api.get('/api/super-admin/usage').catch(() => ({ data: { storage: [], ai: [], totals: { storage: 0, ai: 0, db: 0 }, storageLimit: 1 * 1024 * 1024 * 1024, dbLimit: 500 * 1024 * 1024 } })),
                api.get('/api/super-admin/billing').catch(() => ({ data: { mrr: 0, activeCount: 0, alerts: [] } })),
                api.get('/api/super-admin/forum/reports/pending-count').catch(() => ({ data: { count: 0 } })),
                api.get('/api/super-admin/maintenance').catch(() => ({ data: { enabled: false, message: '' } }))
            ]);

            setStats(statsRes.data);
            setTenants(tenantsRes.data);
            setHealth(healthRes.data);
            setActivities(activitiesRes.data);
            setUsage(usageRes.data);
            setBilling(billingRes.data);
            setPendingReportsCount(pendingRes.data?.count || 0);
            setMaintenanceSettings(maintenanceRes.data);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('[SuperAdminPage] Fetch Error:', err);
            if (!silent) setError(err.response?.data?.error || err.message);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleOpenMaintenanceModal = (shouldToggle = false) => {
        setMaintenanceForm({
            enabled: shouldToggle ? !maintenanceSettings.enabled : !!maintenanceSettings.enabled,
            message: maintenanceSettings.message || (shouldToggle && !maintenanceSettings.enabled ? '現在システムメンテナンス中です。終了までしばらくお待ちください。' : '')
        });
        setIsMaintenanceModalOpen(true);
    };

    const saveMaintenanceSettings = async () => {
        setIsSavingMaintenance(true);
        try {
            const res = await api.post('/api/super-admin/maintenance', maintenanceForm);
            setMaintenanceSettings(res.data);
            setIsMaintenanceModalOpen(false);
            fetchData(true);
        } catch (err) {
            console.error('[MaintenanceUpdate] Error:', err);
            alert('設定の更新に失敗しました: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsSavingMaintenance(false);
        }
    };

    const filteredTenants = (tenants || []).filter(t => {
        const matchesSearch = (t.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.slug || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesPlan = filterPlan === 'all' || (t.plan || 'free').toLowerCase() === filterPlan.toLowerCase();
        return matchesSearch && matchesPlan;
    });

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-40 space-y-4 animate-in fade-in duration-700">
            <div className="w-10 h-10 rounded-full border-[3px] border-white/5 border-t-blue-500 animate-spin"></div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">Loading Assets...</p>
        </div>
    );

    if (error) return (
        <div className="max-w-4xl mx-auto p-12">
            <div className="p-8 bg-red-500/5 border border-red-500/20 rounded-3xl flex items-center gap-6">
                <AlertCircle className="text-red-400" size={32} />
                <div>
                    <h2 className="text-lg font-bold text-white mb-1">エラーが発生しました</h2>
                    <p className="text-red-400/80 text-sm">{error}</p>
                    <button onClick={() => fetchData()} className="mt-4 px-5 py-2 bg-white text-slate-900 rounded-xl text-xs font-black">再読み込み</button>
                </div>
            </div>
        </div>
    );

    const updatedAtTime = lastUpdated.toLocaleTimeString('ja-JP');

    return (
        <div className="h-screen overflow-hidden bg-[#000000] flex flex-col font-sans text-slate-300 antialiased">
            {/* Top Utility Bar */}
            {createPortal(
                <div className="flex items-center gap-4 mr-4">
                    <div className="flex bg-[#1d1d1d] p-1 rounded-lg border border-white/5 mr-4 shadow-inner">
                        <button
                            onClick={() => setActiveView('dashboard')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all",
                                activeView === 'dashboard' ? "bg-[#1677ff] text-white" : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            <LayoutDashboard size={12} /> Dashboard
                        </button>
                        <button
                            onClick={() => setActiveView('logs')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all relative",
                                activeView === 'logs' ? "bg-[#1677ff] text-white" : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            <Terminal size={12} /> System Logs
                            {pendingReportsCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 flex items-center justify-center text-[9px] text-white font-bold border-2 border-[#1d1d1d]">
                                    {pendingReportsCount}
                                </span>
                            )}
                        </button>
                    </div>

                    <div className="flex items-center gap-4 border-l border-white/10 pl-4 pr-4">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-medium text-[#1677ff] uppercase">Realtime Engine</span>
                            <span className="text-[11px] font-mono text-slate-500">{updatedAtTime}</span>
                        </div>
                        <button onClick={() => fetchData()} className="p-1.5 hover:bg-white/5 text-slate-400 rounded transition-colors">
                            <Activity size={14} />
                        </button>
                    </div>
                </div>,
                document.getElementById('su-header-portal') || document.body
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {activeView === 'dashboard' ? (
                    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                        {/* Alerts Section */}
                        {billing.alerts && billing.alerts.length > 0 && (
                            <div className="px-4 pt-4 pb-0 space-y-2 shrink-0">
                                {billing.alerts.map((alert, i) => (
                                    <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-[#fff1f0] border border-[#ffccc7] rounded-md animate-in fade-in">
                                        <div className="flex items-center gap-3">
                                            <AlertCircle size={14} className="text-[#ff4d4f]" />
                                            <span className="text-xs font-medium text-[#141414]">{alert.message}</span>
                                        </div>
                                        <button className="text-[#8c8c8c] hover:text-[#595959]"><ArrowRight size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Stats Row */}
                        <div className="grid grid-cols-4 gap-4 px-4 py-2 shrink-0">
                            <StatCard
                                title="Total Revenue"
                                value={`¥${(billing.totalRevenue || 0).toLocaleString()}`}
                                trend={billing.creditRevenue > 0 ? `+¥${billing.creditRevenue.toLocaleString()} Credits` : 'Base Subscriptions only'}
                                description={`MRR: ¥${(billing.mrr || 0).toLocaleString()}`}
                                color="emerald"
                                icon={TrendingUp}
                            />
                            <StatCard
                                title="Monthly AI Usage"
                                value={(usage.totals?.monthUsage || 0).toLocaleString()}
                                trend="Total Analysis"
                                description={`Est. Cost: ¥${(usage.totals?.estimatedCost || 0).toFixed(1)}`}
                                color="blue"
                                icon={Cpu}
                            />
                            <StatCard icon={Building2} label="Tenants" value={stats?.tenants} color="indigo" description="Total Managed" />
                            <StatCard icon={Users} label="Active Users" value={stats?.users} color="indigo" description="Seats Total" />
                        </div>

                        {/* Main Grid */}
                        <div className="flex-1 flex gap-4 p-4 min-h-0 bg-black/20 overflow-hidden">
                            <section className="flex-[7] min-w-0 bg-[#141414] border border-white/5 rounded-lg overflow-hidden flex flex-col shadow-lg">
                                <div className="px-6 py-4 flex items-center justify-between border-b border-white/5 shrink-0">
                                    <h2 className="text-lg font-semibold text-white">Active Tenants</h2>
                                    <div className="flex gap-3">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                            <input
                                                type="text"
                                                placeholder="Search..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="pl-9 pr-4 py-1.5 bg-[#1d1d1d] border border-white/10 rounded-md text-sm text-white focus:outline-none focus:border-[#1677ff] w-48 transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left">
                                        <thead className="sticky top-0 bg-[#1d1d1d] border-b border-white/5 text-[12px] text-slate-500">
                                            <tr>
                                                <th className="px-6 py-3 w-[25%]">Tenant Identity</th>
                                                <th className="px-4 py-3 text-center w-[10%]">Plan</th>
                                                <th className="px-4 py-3 text-right w-[10%]">Amount</th>
                                                <th className="px-4 py-3 w-[20%]">Usage</th>
                                                <th className="px-4 py-3 text-center w-[10%]">Status</th>
                                                <th className="px-4 py-3 text-center w-[15%]">Renewal</th>
                                                <th className="px-6 py-3 text-right w-[10%]">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {filteredTenants.map((tenant) => {
                                                const planColors = {
                                                    free: "bg-slate-500/10 text-slate-400 border-slate-500/20",
                                                    lite: "bg-blue-500/10 text-blue-400 border-blue-500/20",
                                                    plus: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
                                                    pro: "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                                };
                                                const isAlert = ['past_due', 'unpaid', 'incomplete', 'past_due'].includes(tenant.status);

                                                return (
                                                    <tr key={tenant.id} className={cn(
                                                        "hover:bg-[#1d1d1d] transition-colors group border-l-2 border-transparent",
                                                        isAlert ? "bg-red-500/5 border-l-red-500" : ""
                                                    )}>
                                                        <td className="px-6 py-3">
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-white">{tenant.name}</span>
                                                                <span className="text-[10px] text-slate-500">{tenant.slug}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={cn(
                                                                "px-2 py-0.5 rounded text-[10px] border uppercase font-bold",
                                                                planColors[tenant.plan] || planColors.free
                                                            )}>
                                                                {(tenant.plan || 'free')}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className="text-[11px] font-mono text-slate-300">
                                                                {tenant.amount > 0 ? `¥${tenant.amount.toLocaleString()}` : '--'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col gap-2 w-full max-w-[160px]">
                                                                {/* AI Credits */}
                                                                <div className="flex flex-col">
                                                                    <div className="flex justify-between text-[9px] font-mono mb-0.5 opacity-80">
                                                                        <span className="text-white flex items-center gap-1"><Zap size={8} /> {tenant.creditBalance.toLocaleString()}</span>
                                                                        <span className="text-slate-500">/ {(tenant.monthlyQuota + tenant.purchasedBalance).toLocaleString()}</span>
                                                                    </div>
                                                                    <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                                                                        <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (tenant.creditBalance / (tenant.monthlyQuota + tenant.purchasedBalance || 1)) * 100)}%` }} />
                                                                    </div>
                                                                </div>
                                                                {/* Storage */}
                                                                <div className="flex flex-col">
                                                                    <div className="flex justify-between text-[9px] font-mono mb-0.5 opacity-80">
                                                                        <span className="text-white flex items-center gap-1"><TrendingUp size={8} /> {formatBytes(tenant.storageUsage)}</span>
                                                                        <span className="text-slate-500">/ {getStorageLimitGB(tenant)} GB</span>
                                                                    </div>
                                                                    <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={cn(
                                                                                "h-full transition-all duration-500",
                                                                                (tenant.storageUsage / (getStorageLimitGB(tenant) * 1024 * 1024 * 1024 || 1)) * 100 >= 80 ? "bg-red-500" : "bg-emerald-500"
                                                                            )}
                                                                            style={{ width: `${Math.min(100, (tenant.storageUsage / (getStorageLimitGB(tenant) * 1024 * 1024 * 1024 || 1)) * 100)}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={cn(
                                                                "text-xs capitalize",
                                                                isAlert ? "text-red-400 font-bold" : "text-slate-400"
                                                            )}>
                                                                {tenant.status === 'no_subscription' ? 'Trial' : 
                                                                 tenant.status === 'active' ? 'Active' : 
                                                                 tenant.status === 'trialing' ? 'Confirming' : 
                                                                 tenant.status.replace('_', ' ')}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex flex-col">
                                                                <span className={cn(
                                                                    "text-[11px] font-mono whitespace-nowrap",
                                                                    tenant.expiryDate && new Date(tenant.expiryDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) ? "text-amber-400 font-bold" : "text-slate-400"
                                                                )}>
                                                                    {tenant.expiryDate ? new Date(tenant.expiryDate).toLocaleDateString('ja-JP') : '--'}
                                                                </span>
                                                                {tenant.expiryDate && <span className="text-[9px] text-slate-600 uppercase">Limit</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3 text-right text-[#1677ff] group-hover:translate-x-1 transition-transform"><ArrowRight size={16} /></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            <aside className="flex-[3] min-w-0 flex flex-col gap-4 overflow-hidden">
                                <div className="p-5 bg-[#141414] border border-white/5 rounded-lg shadow-lg shrink-0">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-widest">Engine Cluster</h3>
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                                                <span>Shared DB</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-[10px] text-white">{formatBytes(usage.totals?.db)}</span>
                                                    <span className="text-[10px] text-slate-600">/</span>
                                                    <span className="font-mono text-[10px] text-slate-500">{formatBytes(usage.dbLimit)}</span>
                                                    <span className="text-[10px] font-bold text-[#52c41a] ml-1">({Math.min(100, (usage.totals?.db / (usage.dbLimit || 1)) * 100).toFixed(1)}%)</span>
                                                </div>
                                            </div>
                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-[#52c41a]" style={{ width: `${Math.min(100, (usage.totals?.db / (usage.dbLimit || 1)) * 100)}%` }} />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 pt-2">
                                            <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                                                <span>Storage Mesh</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-[10px] text-white">{formatBytes(usage.totals?.storage)}</span>
                                                    <span className="text-[10px] text-slate-600">/</span>
                                                    <span className="font-mono text-[10px] text-slate-500">{formatBytes(usage.storageLimit)}</span>
                                                    <span className="text-[10px] font-bold text-[#1677ff] ml-1">({Math.min(100, (usage.totals?.storage / (usage.storageLimit || 1)) * 100).toFixed(1)}%)</span>
                                                </div>
                                            </div>
                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-[#1677ff]" style={{ width: `${Math.min(100, (usage.totals?.storage / (usage.storageLimit || 1)) * 100)}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-5 bg-[#141414] border border-white/5 rounded-lg shadow-lg shrink-0">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-widest">System Integrity</h3>
                                    <div className="space-y-2">
                                        <HealthRow label="Supabase DB" status={health.db === 'online' ? 'online' : 'error'} />
                                        <HealthRow label="Supabase Storage" status={health.storage === 'online' ? 'online' : 'error'} />
                                        <HealthRow label="Gemini (Vertex AI)" status={health.ai === 'online' ? 'online' : 'error'} />
                                    </div>
                                </div>

                                <div className="p-5 bg-[#141414] border border-white/5 rounded-lg shadow-lg shrink-0">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-widest">Maintenace Mode</h3>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-10 h-6 p-1 rounded-full transition-colors cursor-pointer",
                                                maintenanceSettings.enabled ? "bg-red-500" : "bg-slate-700"
                                            )} onClick={() => handleOpenMaintenanceModal(true)}>
                                                <div className={cn(
                                                    "w-4 h-4 bg-white rounded-full transition-transform shadow-sm",
                                                    maintenanceSettings.enabled ? "translate-x-4" : "translate-x-0"
                                                )} />
                                            </div>
                                            <span className={cn("text-xs font-bold", maintenanceSettings.enabled ? "text-red-400" : "text-slate-500")}>
                                                {maintenanceSettings.enabled ? "MAINTENANCE ON" : "NORMAL MODE"}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={() => handleOpenMaintenanceModal(false)}
                                            className="text-[10px] text-slate-500 hover:text-white uppercase font-bold tracking-tighter transition-colors"
                                        >
                                            Configure
                                        </button>
                                    </div>
                                    {maintenanceSettings.enabled && (
                                        <div className="mt-3 p-3 bg-red-500/5 border border-red-500/10 rounded-md">
                                            <p className="text-[10px] text-red-400 font-medium line-clamp-2 italic">
                                                "{maintenanceSettings.message}"
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <section className="flex-1 min-h-0 bg-[#141414] border border-white/5 rounded-lg overflow-hidden flex flex-col shadow-lg">
                                    <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02] shrink-0 font-bold text-xs uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                        <Clock size={14} /> Timeline
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                        {activities.slice(0, 15).map((act, i) => {
                                            const iconMap = {
                                                'Building2': Building2,
                                                'UserPlus': UserPlus,
                                                'Zap': Zap,
                                                'CreditCard': BillingIcon,
                                                'Terminal': Terminal,
                                                'AlertCircle': AlertCircle
                                            };
                                            const IconComponent = iconMap[act.icon] || Activity;

                                            // カラーマッピング (Lucideアイコンの色と背景)
                                            const colorMap = {
                                                blue: "text-blue-400 bg-blue-500/10",
                                                indigo: "text-indigo-400 bg-indigo-500/10",
                                                emerald: "text-emerald-400 bg-emerald-500/10",
                                                amber: "text-amber-400 bg-amber-500/10",
                                                red: "text-red-400 bg-red-500/10"
                                            };

                                            return (
                                                <ActivityItem
                                                    key={i}
                                                    title={act.title}
                                                    time={new Date(act.time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                                    detail={act.detail}
                                                    icon={IconComponent}
                                                    colorClass={colorMap[act.color] || colorMap.blue}
                                                />
                                            );
                                        })}
                                    </div>
                                </section>
                            </aside>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 p-4 overflow-hidden">
                        <SuperAdminLogs pendingReportsCount={pendingReportsCount} />
                    </div>
                )}
            </div>

            {/* Maintenance Configuration Modal */}
            {isMaintenanceModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="max-w-md w-full bg-[#1c1c1c] border border-white/10 rounded-[1.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-4 mb-6">
                            <div className={cn(
                                "p-3 rounded-2xl",
                                maintenanceForm.enabled ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"
                            )}>
                                <Power size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Maintenance Control</h3>
                                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">System Overide</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-white">メンテナンスモード</span>
                                    <span className="text-[10px] text-slate-500 uppercase font-black">Force Service Shutdown</span>
                                </div>
                                <button 
                                    onClick={() => setMaintenanceForm(prev => ({ ...prev, enabled: !prev.enabled }))}
                                    className={cn(
                                        "w-12 h-6 p-1 rounded-full transition-colors",
                                        maintenanceForm.enabled ? "bg-red-500" : "bg-slate-700"
                                    )}
                                >
                                    <div className={cn(
                                        "w-4 h-4 bg-white rounded-full transition-transform",
                                        maintenanceForm.enabled ? "translate-x-6" : "translate-x-0"
                                    )} />
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                                    <MessageSquareMore size={12} /> Display Message
                                </label>
                                <textarea 
                                    value={maintenanceForm.message}
                                    onChange={(e) => setMaintenanceForm(prev => ({ ...prev, message: e.target.value }))}
                                    placeholder="メンテナンスの理由や終了予定時刻を入力してください..."
                                    className="w-full h-32 bg-[#141414] border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors resize-none custom-scrollbar"
                                />
                                <p className="text-[10px] text-slate-500 italic px-1">
                                    ※このメッセージはログイン中の全ユーザー、および未ログインの訪問者に表示されます。
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 flex gap-3">
                            <button 
                                onClick={() => setIsMaintenanceModalOpen(false)}
                                className="flex-1 py-3 bg-white/5 text-slate-300 font-bold rounded-xl hover:bg-white/10 transition-all text-sm uppercase tracking-widest"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={saveMaintenanceSettings}
                                disabled={isSavingMaintenance}
                                className={cn(
                                    "flex-[2] py-3 text-white font-bold rounded-xl transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2",
                                    maintenanceForm.enabled 
                                        ? "bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/20" 
                                        : "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20",
                                    isSavingMaintenance && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                {isSavingMaintenance ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Apply Settings"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Supporting Components ---

function StatCard({ icon: Icon, label, title, value, color, trend, description }) {
    const colorMap = {
        emerald: "text-[#52c41a]",
        blue: "text-[#1677ff]",
        red: "text-[#ff4d4f]",
        indigo: "text-[#1d39c4]",
        slate: "text-slate-400"
    };
    return (
        <div className="bg-[#141414] border border-white/5 rounded-lg p-5 flex flex-col gap-3 transition-all hover:border-[#1677ff]/30">
            <div className="flex items-center justify-between">
                <div className={cn("p-2 rounded-md bg-white/5", colorMap[color] || colorMap.slate)}>
                    <Icon size={18} />
                </div>
                {trend && <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded uppercase">{trend}</span>}
            </div>
            <div>
                <p className="text-[12px] text-slate-400 mb-1">{label || title}</p>
                <div className="flex items-baseline gap-2">
                    <p className="text-xl font-bold text-white">{value || 0}</p>
                    {description && <p className="text-[10px] text-slate-500 truncate">{description}</p>}
                </div>
            </div>
        </div>
    );
}

function ActivityItem({ icon: Icon, title, time, detail, colorClass }) {
    return (
        <div className="flex gap-4 group">
            <div className={cn(
                "w-8 h-8 rounded flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                colorClass || "bg-white/5 text-slate-500"
            )}>
                <Icon size={14} />
            </div>
            <div className="min-w-0 flex-1 border-b border-white/5 pb-3">
                <div className="flex justify-between items-center mb-0.5">
                    <p className="text-[13px] font-semibold text-white truncate">{title}</p>
                    <span className="text-[10px] font-mono text-slate-600">{time}</span>
                </div>
                <p className="text-[11px] text-slate-500 truncate group-hover:text-slate-400 transition-colors">{detail}</p>
            </div>
        </div>
    );
}

function HealthRow({ label, status }) {
    return (
        <div className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-3">
                <div className={cn(
                    "w-3 h-3 rounded-full shadow-lg", 
                    status === 'online' ? "bg-[#52c41a] shadow-[#52c41a]/20" : "bg-[#ff4d4f] shadow-[#ff4d4f]/20"
                )} />
                <span className="text-sm text-slate-400 font-medium">{label}</span>
            </div>
        </div>
    );
}
