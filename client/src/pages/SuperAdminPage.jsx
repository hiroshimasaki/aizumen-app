import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Users,
    Building2,
    Search,
    ArrowRight,
    Database,
    ShieldCheck,
    Activity,
    Globe,
    Cpu,
    Clock,
    UserPlus,
    CreditCard as BillingIcon,
    AlertCircle,
    Zap,
    TrendingUp,
    ArrowUpRight
} from 'lucide-react';
import api from '../lib/api';
import { cn } from '../lib/utils';

/**
 * Super Admin (サービス管理者) 専用ダッシュボード
 * スタイリッシュさと視認性を両立させた Apple HIG 準拠デザイン
 */
export default function SuperAdminPage() {
    const [stats, setStats] = useState(null);
    const [tenants, setTenants] = useState([]);
    const [health, setHealth] = useState({ db: 'loading', storage: 'loading', ai: 'loading' });
    const [activities, setActivities] = useState([]);
    const [usage, setUsage] = useState({ storage: [], ai: [], totals: { storage: 0, ai: 0, db: 0 }, storageLimit: 1 * 1024 * 1024 * 1024, dbLimit: 500 * 1024 * 1024 });
    const [billing, setBilling] = useState({ mrr: 0, activeCount: 0, alerts: [] });
    const [activityFilter, setActivityFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPlan, setFilterPlan] = useState('all');
    const [lastUpdated, setLastUpdated] = useState(new Date());

    const REFRESH_INTERVAL = 60000; // 60秒

    useEffect(() => {
        fetchData();
        const interval = setInterval(() => {
            fetchData(true);
        }, REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async (silent = false) => {
        console.log('[SuperAdminPage] Fetching data (silent:', silent, ')...');
        if (!silent) setLoading(true);
        try {
            const [statsRes, tenantsRes, healthRes, activitiesRes, usageRes, billingRes] = await Promise.all([
                api.get('/api/super-admin/stats'),
                api.get('/api/super-admin/tenants'),
                api.get('/api/super-admin/health').catch(() => ({ data: { db: 'error', storage: 'error', ai: 'error' } })),
                api.get('/api/super-admin/activities').catch(() => ({ data: [] })),
                api.get('/api/super-admin/usage').catch(() => ({ data: { storage: [], ai: [], totals: { storage: 0, ai: 0, db: 0 }, storageLimit: 1 * 1024 * 1024 * 1024, dbLimit: 500 * 1024 * 1024 } })),
                api.get('/api/super-admin/billing').catch(() => ({ data: { mrr: 0, activeCount: 0, alerts: [] } }))
            ]);

            console.log('[SuperAdminPage] Data fetched successfully');
            setStats(statsRes.data);
            setTenants(tenantsRes.data);
            setHealth(healthRes.data);
            setActivities(activitiesRes.data);
            setUsage(usageRes.data);
            setBilling(billingRes.data);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('[SuperAdminPage] General Fetch Error:', err);
            if (!silent) setError(err.response?.data?.error || err.message);
        } finally {
            if (!silent) setLoading(false);
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
            <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] ml-1">Loading Assets...</p>
        </div>
    );

    if (error) return (
        <div className="max-w-4xl mx-auto p-12 animate-in slide-in-from-bottom-4 duration-500">
            <div className="p-8 bg-red-500/5 border border-red-500/20 rounded-3xl flex items-center gap-6">
                <div className="p-4 bg-red-500/10 rounded-2xl">
                    <AlertCircle className="text-red-400" size={32} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-white mb-1">エラーが発生しました</h2>
                    <p className="text-red-400/80 text-sm font-medium">{error}</p>
                    <button onClick={fetchData} className="mt-4 px-5 py-2 bg-white text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition-all active:scale-95">再読み込みを試行</button>
                </div>
            </div>
        </div>
    );

    const updatedAtTime = lastUpdated.toLocaleTimeString('ja-JP');

    return (
        <div className="h-screen overflow-hidden bg-[#000000] flex flex-col font-sans text-slate-300 antialiased">
            {/* Top Utility Bar - Portal to App Header: Ant Design style */}
            {createPortal(
                <div className="flex items-center gap-4 mr-4 border-r border-white/10 pr-4">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-medium text-[#1677ff] uppercase tracking-wider">Realtime Engine</span>
                        <span className="text-[11px] font-mono text-slate-500">{updatedAtTime}</span>
                    </div>
                    <button
                        onClick={() => fetchData()}
                        className="p-1.5 hover:bg-white/5 text-slate-400 rounded transition-colors"
                        title="Force Refresh"
                    >
                        <Activity size={14} />
                    </button>
                </div>,
                document.getElementById('su-header-portal') || document.body
            )}

            {/* Alerts Section (System Messages) */}
            {billing.alerts && billing.alerts.length > 0 && (
                <div className="px-4 pt-4 pb-0 space-y-2">
                    {billing.alerts.map((alert, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-[#fff1f0] border border-[#ffccc7] rounded-md animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-3">
                                <AlertCircle size={14} className="text-[#ff4d4f]" />
                                <span className="text-xs font-medium text-[#141414]">{alert.message}</span>
                            </div>
                            <button className="text-[#8c8c8c] hover:text-[#595959] transition-colors">
                                <ArrowRight size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Stats Row: High Density 4-Columns */}
            <div className="grid grid-cols-4 gap-4 px-4 py-2">
                <StatCard
                    title="Total Revenue"
                    value={`¥${(billing.totalRevenue || 0).toLocaleString()}`}
                    trend={billing.creditRevenue > 0 ? `+¥${billing.creditRevenue.toLocaleString()} Credits` : 'Base Subscriptions only'}
                    description={`MRR: ¥${(billing.mrr || 0).toLocaleString()}`}
                    color="emerald"
                    icon={TrendingUp}
                />
                <StatCard
                    title="Alerts"
                    value={billing.alerts?.length || 0}
                    trend={billing.alerts?.length > 0 ? 'Critical Attention' : 'System Secure'}
                    color={billing.alerts?.length > 0 ? "red" : "slate"}
                    icon={AlertCircle}
                />
                <StatCard
                    icon={Building2}
                    label="Tenants"
                    value={stats?.tenants}
                    color="blue"
                    description={`Free ${stats?.plans?.free || 0} / Lite ${stats?.plans?.lite || 0} / Plus ${stats?.plans?.plus || 0} / Pro ${stats?.plans?.pro || 0}`}
                />
                <StatCard
                    icon={Users}
                    label="Active Users"
                    value={stats?.users}
                    color="indigo"
                    description="Seats Total"
                />
            </div>

            {/* Main Content Area: 2 Columns Split (70:30) - Reduced Gaps/Padding */}
            <div className="flex-1 flex gap-4 p-4 min-h-0 bg-black/20">
                {/* Left Column: Primary Data (70%) */}
                <section className="flex-[7] min-w-0 bg-[#141414] border border-white/5 rounded-lg overflow-hidden flex flex-col shadow-lg">
                    <div className="px-6 py-4 flex items-center justify-between border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-semibold text-white">Active Tenants</h2>
                            <span className="px-2 py-0.5 bg-white/5 text-slate-500 text-[11px] rounded border border-white/5">{filteredTenants.length} Total</span>
                        </div>
                        <div className="flex gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search tenants..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 pr-4 py-1.5 bg-[#1d1d1d] border border-white/10 rounded-md text-sm text-white focus:outline-none focus:border-[#1677ff] transition-all w-48 placeholder:text-slate-600"
                                />
                            </div>
                            <select
                                value={filterPlan}
                                onChange={(e) => setFilterPlan(e.target.value)}
                                className="px-3 py-1.5 bg-[#1d1d1d] border border-white/10 rounded-md text-sm font-medium text-white focus:outline-none focus:border-[#1677ff] cursor-pointer hover:bg-white/5 transition-colors"
                            >
                                <option value="all" className="bg-[#1d1d1d] text-white">全てのプラン</option>
                                <option value="free" className="bg-[#1d1d1d] text-white">Free</option>
                                <option value="lite" className="bg-[#1d1d1d] text-white">Lite</option>
                                <option value="plus" className="bg-[#1d1d1d] text-white">Plus</option>
                                <option value="pro" className="bg-[#1d1d1d] text-white">Pro</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse table-fixed">
                            <thead className="sticky top-0 z-10 bg-[#1d1d1d] border-b border-white/5">
                                <tr>
                                    <th className="px-6 py-3 text-[12px] font-medium text-slate-500 w-[40%]">Tenant Identity</th>
                                    <th className="px-4 py-3 text-[12px] font-medium text-slate-500 text-center w-[15%]">Plan</th>
                                    <th className="px-4 py-3 text-[12px] font-medium text-slate-500 w-[25%]">Usage</th>
                                    <th className="px-4 py-3 text-[12px] font-medium text-slate-500 text-center w-[10%]">Status</th>
                                    <th className="px-6 py-3 text-[12px] font-medium text-slate-500 text-right w-[10%]">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredTenants.length > 0 ? filteredTenants.map((tenant) => (
                                    <tr key={tenant.id} className="group hover:bg-[#1d1d1d] transition-colors cursor-default">
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-[#1677ff] group-hover:border-[#1677ff]/40 transition-colors shrink-0">
                                                    <Building2 size={16} />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[14px] font-medium text-white truncate">{tenant.name}</span>
                                                    <span className="text-[11px] font-mono text-slate-500 truncate">{tenant.slug}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded text-[11px] font-medium border",
                                                tenant.plan === 'pro' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                    tenant.plan === 'plus' ? 'bg-[#e6f4ff] text-[#1677ff] border-[#91caff]' :
                                                        tenant.plan === 'lite' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                                            'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                            )}>
                                                {(tenant.plan || 'free').toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex justify-between items-center text-[11px]">
                                                    <span className="text-slate-400">{(tenant.creditBalance || 0).toLocaleString()} <span className="text-[10px]">Credits</span></span>
                                                    <span className="text-slate-500">{((tenant.creditBalance / (tenant.monthlyQuota + tenant.purchasedBalance || 1)) * 100).toFixed(0)}%</span>
                                                </div>
                                                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                                    <div
                                                        className="h-full bg-[#1677ff] transition-all duration-1000"
                                                        style={{ width: `${Math.min(100, (tenant.creditBalance / (tenant.monthlyQuota + tenant.purchasedBalance || 1)) * 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className={cn(
                                                    "w-1.5 h-1.5 rounded-full",
                                                    tenant.status === 'active' ? 'bg-[#52c41a]' : 'bg-[#ff4d4f]'
                                                )} />
                                                <span className="text-[11px] text-slate-400 capitalize">{tenant.status}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <button className="text-[#1677ff] hover:text-[#4096ff] transition-colors p-1">
                                                <ArrowRight size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="5" className="p-12 text-center text-slate-600 text-[12px]">No data found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Right Column: Secondary Data Sidebar (30%) */}
                <aside className="flex-[3] min-w-0 flex flex-col gap-4 overflow-hidden">
                    {/* Infrastructure Segment (Fixed on Top) */}
                    <div className="shrink-0 flex flex-col gap-4">
                        <div className="p-5 bg-[#141414] border border-white/5 rounded-lg shadow-lg">
                            <div className="flex items-center gap-3 mb-5">
                                <Cpu size={16} className="text-[#52c41a]" />
                                <h3 className="text-sm font-semibold text-white uppercase tracking-tight">Engine Cluster</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[11px] text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <span>Shared Database</span>
                                            <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded">
                                                {(usage.totals?.db / (1024 * 1024)).toFixed(1)}MB / {(usage.dbLimit / (1024 * 1024)).toFixed(0)}MB
                                            </span>
                                        </div>
                                        <span className="text-[#52c41a] font-mono">{((usage.totals?.db / (usage.dbLimit || 1)) * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-[#52c41a] transition-all duration-1000" style={{ width: `${Math.min(100, (usage.totals?.db / (usage.dbLimit || 1)) * 100)}%` }} />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[11px] text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <span>Infrastructure S3</span>
                                            <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded">
                                                {(usage.totals?.storage / (1024 * 1024 * 1024)).toFixed(2)}GB / {(usage.storageLimit / (1024 * 1024 * 1024)).toFixed(0)}GB
                                            </span>
                                        </div>
                                        <span className="text-[#1677ff] font-mono">{((usage.totals?.storage / (usage.storageLimit || 1)) * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-[#1677ff] transition-all duration-1000" style={{ width: `${Math.min(100, (usage.totals?.storage / (usage.storageLimit || 1)) * 100)}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 bg-[#141414] border border-white/5 rounded-lg shadow-lg">
                            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-tight">System Integrity</h3>
                            <div className="space-y-1">
                                <HealthRow label="DB Nodes" status={health.db === 'online' ? 'online' : 'error'} latency="< 5ms" />
                                <HealthRow label="Asset Mesh" status={health.storage === 'online' ? 'online' : 'error'} latency="12ms" />
                                <HealthRow label="AI Pipeline" status={health.ai === 'online' ? 'online' : 'error'} latency="ACTIVE" />
                            </div>
                            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-600 font-medium tracking-wider">
                                <span>REG: AP-TYO</span>
                                <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#52c41a]" /> ONLINE</div>
                            </div>
                        </div>
                    </div>

                    {/* Activity Feed Segment: Ant Design Style (Scrollable at Bottom) */}
                    <section className="flex-1 min-h-0 bg-[#141414] border border-white/5 rounded-lg overflow-hidden flex flex-col shadow-lg">
                        <div className="px-5 py-3 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
                            <div className="flex items-center gap-2">
                                <Clock size={16} className="text-[#1677ff]" />
                                <h3 className="text-sm font-semibold text-white uppercase tracking-tight">Timeline</h3>
                            </div>
                            <div className="flex bg-[#1d1d1d] p-0.5 rounded border border-white/5">
                                <button onClick={() => setActivityFilter('all')} className={cn("px-2 py-1 rounded text-[10px] transition-all", activityFilter === 'all' ? "bg-[#1677ff] text-white shadow-sm" : "text-slate-500")}><Activity size={10} /></button>
                                <button onClick={() => setActivityFilter('ai_usage')} className={cn("px-2 py-1 rounded text-[10px] transition-all", activityFilter === 'ai_usage' ? "bg-[#1677ff] text-white shadow-sm" : "text-slate-500")}><Zap size={10} /></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                            {activities
                                .filter(act => {
                                    if (activityFilter === 'all') return true;
                                    return act.type === activityFilter;
                                })
                                .slice(0, 15).map((act, i) => (
                                    <ActivityItem
                                        key={`${act.time}-${i}`}
                                        icon={act.icon === 'Zap' ? Zap : act.icon === 'Building2' ? Building2 : act.icon === 'UserPlus' ? UserPlus : act.icon === 'CreditCard' ? BillingIcon : Activity}
                                        title={act.title}
                                        time={new Date(act.time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                        detail={act.detail}
                                        color={act.color}
                                        isNewest={i === 0}
                                    />
                                ))}
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}

// --- Supporting Components ---

function FilterButton({ active, onClick, label, icon: Icon }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-300",
                active ? "bg-white/10 text-white shadow-lg ring-1 ring-white/10" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            )}
        >
            <Icon size={14} className={active ? "text-blue-400" : "text-slate-600"} />
            {label}
        </button>
    );
}

function RankingRow({ label, value, percentage, color }) {
    const colorClasses = {
        emerald: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]",
        blue: "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]"
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-[13px] font-bold">
                <span className="text-white/70 truncate max-w-[200px]">{label}</span>
                <span className="text-white font-mono">{value}</span>
            </div>
            <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden border border-white/5">
                <div
                    className={cn("h-full rounded-full transition-all duration-1000", colorClasses[color] || "bg-indigo-500")}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, label, title, value, color, trend, description }) {
    // Ant Design tokens
    const colorMap = {
        blue: { text: 'text-[#1677ff]', bg: 'bg-[#e6f4ff]', border: 'border-[#91caff]' },
        indigo: { text: 'text-[#1d39c4]', bg: 'bg-[#f0f5ff]', border: 'border-[#adc6ff]' },
        emerald: { text: 'text-[#52c41a]', bg: 'bg-[#f6ffed]', border: 'border-[#b7eb8f]' },
        red: { text: 'text-[#ff4d4f]', bg: 'bg-[#fff1f0]', border: 'border-[#ffccc7]' },
        slate: { text: 'text-slate-400', bg: 'bg-white/5', border: 'border-white/10' },
    };

    const token = colorMap[color] || colorMap.slate;

    return (
        <div className="bg-[#141414] border border-white/5 rounded-lg p-5 flex flex-col gap-3 transition-all hover:border-[#1677ff]/50">
            <div className="flex items-center justify-between">
                <div className={cn("p-2 rounded-md flex items-center justify-center bg-white/5", token.text)}>
                    <Icon size={18} />
                </div>
                {trend && (
                    <span className="text-[11px] font-medium text-slate-500 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                        {trend}
                    </span>
                )}
            </div>
            <div className="space-y-1">
                <p className="text-[13px] font-normal text-slate-400">{label || title}</p>
                <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-semibold text-white tracking-tight">{value || 0}</p>
                    {description && <p className="text-[11px] text-slate-500 font-normal truncate">{description}</p>}
                </div>
            </div>
        </div>
    );
}

function ActivityItem({ icon: Icon, title, time, detail, color, isNewest }) {
    const colorMap = {
        blue: 'text-[#1677ff] bg-[#e6f4ff]',
        indigo: 'text-[#1d39c4] bg-[#f0f5ff]',
        amber: 'text-[#faad14] bg-[#fffbe6]',
        emerald: 'text-[#52c41a] bg-[#f6ffed]',
        red: 'text-[#ff4d4f] bg-[#fff1f0]',
    };

    return (
        <div className={cn(
            "flex gap-4 p-3 rounded-lg transition-colors hover:bg-white/[0.02] border border-transparent hover:border-white/5 group relative",
            isNewest && "bg-white/[0.01] border-white/5"
        )}>
            <div className={cn(
                "w-8 h-8 rounded flex items-center justify-center shrink-0 shadow-sm",
                colorMap[color] || 'text-slate-400 bg-white/5'
            )}>
                <Icon size={14} />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-medium text-white truncate">{title}</span>
                    <span className="text-[11px] text-slate-500 font-normal whitespace-nowrap">{time}</span>
                </div>
                <p className="text-[12px] text-slate-500 line-clamp-1 font-normal">
                    {detail}
                </p>
            </div>
        </div>
    );
}

function HealthRow({ label, status, latency }) {
    return (
        <div className="flex items-center justify-between p-2 rounded hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-2">
                <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    status === 'online' ? "bg-[#52c41a]" :
                        status === 'loading' ? "bg-slate-500 animate-pulse" :
                            "bg-[#ff4d4f] animate-pulse"
                )} />
                <span className="text-[13px] text-slate-300">{label}</span>
            </div>
            <span className="text-[11px] font-mono text-slate-600">{latency}</span>
        </div>
    );
}
