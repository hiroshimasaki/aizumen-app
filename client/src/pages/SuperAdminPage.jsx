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
        const matchesPlan = filterPlan === 'all' || t.plan === filterPlan;
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
        <div className="max-w-full px-6 py-6 space-y-6 animate-in fade-in duration-700">
            {/* Top Utility Bar - Portal to App Header */}
            {createPortal(
                <div className="flex items-center gap-4 mr-4 border-r border-white/10 pr-4">
                    <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[8px] font-black text-blue-500/60 uppercase tracking-widest leading-none">Auto Update Active</span>
                        <span className="text-[10px] font-mono text-white/30">{updatedAtTime}</span>
                    </div>
                    <button
                        onClick={() => fetchData()}
                        className="p-1.5 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-all active:scale-95 group"
                        title="手動更新"
                    >
                        <Activity size={12} className="text-blue-400 group-hover:rotate-180 transition-transform duration-500" />
                    </button>
                </div>,
                document.getElementById('su-header-portal') || document.body
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Content (8 cols) */}
                <div className="lg:col-span-8 space-y-8">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <StatCard
                            title="Revenue (MRR)"
                            value={`¥${(billing.mrr || 0).toLocaleString()}`}
                            trend={billing.activeCount > 0 ? `Active: ${billing.activeCount}` : 'No active subs'}
                            color="emerald"
                            icon={TrendingUp}
                        />
                        <StatCard
                            title="Payment Alerts"
                            value={billing.alerts?.length || 0}
                            trend={billing.alerts?.length > 0 ? 'Action Required' : 'All clear'}
                            color={billing.alerts?.length > 0 ? "red" : "slate"}
                            icon={AlertCircle}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <StatCard
                            icon={Building2}
                            label="総テナント数"
                            value={stats?.tenants}
                            color="blue"
                            description={`Lite:${stats?.plans?.lite || 0}  Plus:${stats?.plans?.plus || 0}  Pro:${stats?.plans?.pro || 0}`}
                        />
                        <StatCard
                            icon={Users}
                            label="アクティブユーザー"
                            value={stats?.users}
                            color="indigo"
                        />
                    </div>

                    {/* Tenant List */}
                    <section className="space-y-5">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-black text-white">テナント</h2>
                                <span className="text-[10px] bg-white/5 text-slate-500 px-2 py-0.5 rounded border border-white/5 font-bold">{filteredTenants.length}件</span>
                            </div>

                            <div className="flex gap-2">
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={12} />
                                    <input
                                        type="text"
                                        placeholder="検索"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-8 pr-4 py-1.5 bg-white/5 border border-white/5 rounded-lg text-xs text-white focus:outline-none focus:bg-white/10 focus:border-white/10 transition-all w-32 md:w-40 placeholder:text-slate-600"
                                    />
                                </div>
                                <select
                                    value={filterPlan}
                                    onChange={(e) => setFilterPlan(e.target.value)}
                                    className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[10px] font-bold text-white focus:outline-none appearance-none cursor-pointer"
                                >
                                    <option value="all">全プラン</option>
                                    <option value="lite">LITE</option>
                                    <option value="plus">PLUS</option>
                                    <option value="pro">PRO</option>
                                </select>
                            </div>
                        </div>

                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-3xl overflow-hidden backdrop-blur-3xl shadow-xl">
                            <table className="w-full text-left border-collapse">
                                <thead className="border-b border-white/5">
                                    <tr>
                                        <th className="p-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">テナント情報</th>
                                        <th className="p-5 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">プラン</th>
                                        <th className="p-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">AIクレジット</th>
                                        <th className="p-5 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">状態</th>
                                        <th className="p-5 text-[9px] font-black text-slate-500 uppercase tracking-widest text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredTenants.length > 0 ? filteredTenants.map((tenant) => (
                                        <tr key={tenant.id} className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="p-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 flex items-center justify-center text-white/20 group-hover:text-white/60 transition-colors">
                                                        <Building2 size={18} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">{tenant.name}</span>
                                                        <span className="text-[9px] font-mono text-slate-600 uppercase mt-0.5">{tenant.slug}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex justify-center">
                                                    <span className={cn(
                                                        "px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border",
                                                        tenant.plan === 'pro' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                            tenant.plan === 'plus' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                                'bg-slate-500/10 text-slate-400 border-white/10'
                                                    )}>
                                                        {tenant.plan}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex flex-col gap-1.5 min-w-[100px]">
                                                    <div className="flex justify-between items-center text-[10px] font-bold">
                                                        <span className="text-white">{tenant.creditBalance?.toLocaleString()}</span>
                                                        <span className="text-slate-600">/ {(tenant.monthlyQuota + tenant.purchasedBalance)?.toLocaleString()}</span>
                                                    </div>
                                                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-emerald-500/50 rounded-full"
                                                            style={{ width: `${Math.min(100, (tenant.creditBalance / (tenant.monthlyQuota + tenant.purchasedBalance || 1)) * 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5 text-center">
                                                <div className="inline-flex items-center gap-1.5">
                                                    {(() => {
                                                        const s = tenant.status;
                                                        const config = {
                                                            active: { label: '有効', color: 'text-emerald-400', dot: 'bg-emerald-400' },
                                                            trialing: { label: 'トライアル', color: 'text-blue-400', dot: 'bg-blue-400' },
                                                            past_due: { label: '支払い待ち', color: 'text-amber-400', dot: 'bg-amber-400' },
                                                            unpaid: { label: '滞納', color: 'text-red-400', dot: 'bg-red-400' },
                                                            canceled: { label: '解約済', color: 'text-slate-500', dot: 'bg-slate-500' },
                                                            no_subscription: { label: '未契約', color: 'text-slate-500', dot: 'bg-slate-500' },
                                                            incomplete: { label: '登録中', color: 'text-amber-400', dot: 'bg-amber-400' },
                                                        };
                                                        const { label, color, dot } = config[s] || { label: '不明', color: 'text-slate-400', dot: 'bg-slate-400' };
                                                        return (
                                                            <>
                                                                <div className={cn("w-1.5 h-1.5 rounded-full", dot)} />
                                                                <span className={cn("text-[9px] font-bold uppercase", color)}>{label}</span>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </td>
                                            <td className="p-5 text-right">
                                                <button className="p-2 transition-transform group-hover:translate-x-1">
                                                    <ArrowRight size={14} className="text-slate-600 group-hover:text-white" />
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan="4" className="p-16 text-center text-slate-600 text-[10px] font-bold uppercase">データがありません</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                {/* Sidebar (4 cols) */}
                <div className="lg:col-span-4 space-y-8">
                    {/* Utilization Ranking */}
                    <div className="p-6 bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-3xl space-y-6 backdrop-blur-2xl">
                        <div className="flex items-center gap-2 mb-1">
                            <Zap size={16} className="text-emerald-400" />
                            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Resource Monitoring</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pb-4 border-b border-white/5">
                            <div className="space-y-1">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Global DB Usage</span>
                                <div className="flex flex-col gap-1.5">
                                    <p className="text-lg font-black text-emerald-400">
                                        {(usage.totals?.db / (1024 * 1024)).toFixed(1)} <span className="text-emerald-500/50 uppercase ml-0.5 text-[10px]">MB</span>
                                        <span className="text-[10px] text-slate-500 tracking-normal font-bold mx-1">/</span>
                                        <span className="text-[10px] text-slate-500 tracking-normal font-bold">{(usage.dbLimit / (1024 * 1024)).toFixed(0)} MB</span>
                                    </p>
                                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 transition-all duration-1000"
                                            style={{ width: `${Math.min(100, (usage.totals?.db / (usage.dbLimit || 1)) * 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center text-[8px] font-black text-slate-600 uppercase tracking-widest">
                                        <span>Capacity Audit</span>
                                        <span>{((usage.totals?.db / (usage.dbLimit || 1)) * 100).toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest text-right block">Global Storage Usage</span>
                                <div className="flex flex-col gap-1.5">
                                    <p className="text-lg font-black text-blue-400 text-right">
                                        {(usage.totals?.storage / (1024 * 1024)).toFixed(1)} <span className="text-blue-500/50 uppercase ml-0.5 text-[10px]">MB</span>
                                        <span className="text-[10px] text-slate-500 tracking-normal font-bold mx-1">/</span>
                                        <span className="text-[10px] text-slate-500 tracking-normal font-bold">{(usage.storageLimit / (1024 * 1024 * 1024)).toFixed(1)} GB</span>
                                    </p>
                                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 transition-all duration-1000"
                                            style={{ width: `${Math.min(100, (usage.totals?.storage / (usage.storageLimit || 1)) * 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center text-[8px] font-black text-slate-600 uppercase tracking-widest">
                                        <span>{((usage.totals?.storage / (usage.storageLimit || 1)) * 100).toFixed(1)}% Used</span>
                                        <span>CAP: {(usage.storageLimit / (1024 * 1024 * 1024)).toFixed(1)} GB</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <h4 className="text-[9px] font-bold text-slate-500 uppercase mb-3 tracking-wider">AI Analysis (Top 5)</h4>
                                <div className="space-y-3">
                                    {usage.ai.slice(0, 5).map((u, i) => (
                                        <RankingRow key={i} label={u.name} value={`${u.count} pts`} percentage={Math.min(100, (u.count / 1000) * 100)} color="emerald" />
                                    ))}
                                    {usage.ai.length === 0 && <p className="text-[9px] text-slate-700 italic">No data yet</p>}
                                </div>
                            </div>
                            <div className="pt-4 border-t border-white/5">
                                <h4 className="text-[9px] font-bold text-slate-500 uppercase mb-3 tracking-wider">Storage Usage (Top 5)</h4>
                                <div className="space-y-3">
                                    {usage.storage.slice(0, 5).map((u, i) => (
                                        <RankingRow key={i} label={u.name} value={`${(u.size / (1024 * 1024)).toFixed(1)} MB`} percentage={Math.min(100, (u.size / (usage.storageLimit || 1024 * 1024 * 1024)) * 100)} color="blue" />
                                    ))}
                                    {usage.storage.length === 0 && <p className="text-[9px] text-slate-700 italic">No data yet</p>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* System Health Section */}
                    <div className="p-6 bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-3xl space-y-6 backdrop-blur-2xl">
                        <div className="flex items-center gap-2 mb-1">
                            <Cpu size={16} className="text-white/30" />
                            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">System Health</h3>
                        </div>

                        <div className="space-y-4">
                            <HealthRow label="Database" status={health.db === 'online' ? 'online' : 'error'} latency={health.db === 'online' ? '< 5ms' : '-'} />
                            <HealthRow label="Storage" status={health.storage === 'online' ? 'online' : 'error'} latency={health.storage === 'online' ? '12ms' : '-'} />
                            <HealthRow label="AI Service" status={health.ai === 'online' ? 'online' : 'error'} latency={health.ai === 'online' ? `RPM: ${health.limits?.geminiRpm || '-'}` : '-'} />
                        </div>

                        <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[8px] font-black uppercase text-slate-600 tracking-widest">
                            <span>Global Network</span>
                            <span className="text-white flex items-center gap-1.5"><Globe size={10} /> JP-TYO-1</span>
                        </div>
                    </div>

                    {/* Filtered Activity Feed */}
                    <div className="space-y-6 px-1">
                        <div className="flex flex-col space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Clock size={14} className="text-blue-400/60" />
                                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Activity Feed</h3>
                                </div>
                            </div>

                            <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5 self-start">
                                <FilterButton active={activityFilter === 'all'} onClick={() => setActivityFilter('all')} label="すべて" icon={Activity} />
                                <FilterButton active={activityFilter === 'ai_usage'} onClick={() => setActivityFilter('ai_usage')} label="AI" icon={Zap} />
                                <FilterButton active={activityFilter === 'tenant_created'} onClick={() => setActivityFilter('tenant_created')} label="登録" icon={Building2} />
                                <FilterButton active={activityFilter === 'billing'} onClick={() => setActivityFilter('billing')} label="決済" icon={BillingIcon} />
                            </div>
                        </div>

                        <div className="space-y-5">
                            {activities
                                .filter(act => {
                                    if (activityFilter === 'all') return true;
                                    if (activityFilter === 'billing') return act.type === 'billing' || act.type === 'payment_failed';
                                    return act.type === activityFilter;
                                })
                                .length > 0 ?
                                activities
                                    .filter(act => {
                                        if (activityFilter === 'all') return true;
                                        if (activityFilter === 'billing') return act.type === 'billing' || act.type === 'payment_failed';
                                        return act.type === activityFilter;
                                    })
                                    .slice(0, 10).map((act, i) => (
                                        <div key={`${act.time}-${i}`} className="animate-activity-in" style={{ animationDelay: `${i * 0.05}s` }}>
                                            <ActivityItem
                                                icon={act.icon === 'Zap' ? Zap : act.icon === 'Building2' ? Building2 : act.icon === 'UserPlus' ? UserPlus : act.icon === 'CreditCard' ? BillingIcon : Activity}
                                                title={act.title}
                                                time={new Date(act.time).toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                                detail={act.detail}
                                                color={act.color}
                                            />
                                        </div>
                                    )) : (
                                    <p className="text-[10px] text-slate-600 font-bold uppercase py-4">該当なし</p>
                                )}
                        </div>
                    </div>
                </div>
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
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[9px] font-black uppercase transition-all",
                active ? "bg-white/10 text-white" : "text-slate-600 hover:text-slate-400"
            )}
        >
            <Icon size={10} className={active ? "text-blue-400" : "text-slate-700"} />
            {label}
        </button>
    );
}

function RankingRow({ label, value, percentage, color }) {
    const colorClasses = {
        emerald: "bg-emerald-500",
        blue: "bg-blue-500"
    };

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-white/60 truncate max-w-[140px]">{label}</span>
                <span className="text-white font-mono">{value}</span>
            </div>
            <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                    className={cn("h-full rounded-full transition-all duration-1000", colorClasses[color] || "bg-indigo-500")}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, label, title, value, color, trend, description }) {
    const colorClasses = {
        blue: 'text-blue-400 from-blue-500/5 to-transparent border-blue-500/10',
        indigo: 'text-indigo-400 from-indigo-500/5 to-transparent border-indigo-500/10',
        emerald: 'text-emerald-400 from-emerald-500/5 to-transparent border-emerald-500/10',
        red: 'text-red-400 from-red-500/5 to-transparent border-red-500/10',
        slate: 'text-slate-400 from-white/5 to-transparent border-white/10',
    };

    return (
        <div className={cn(
            "p-6 rounded-[2rem] bg-gradient-to-br border backdrop-blur-3xl transition-all duration-300 hover:scale-[1.01] hover:bg-white/[0.02] group shadow-lg shadow-black/5",
            colorClasses[color]
        )}>
            <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 bg-white/5 rounded-xl border border-white/5">
                    <Icon size={20} />
                </div>
                {trend && (
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-40 px-2 py-0.5 bg-white/5 rounded-full border border-white/5">
                        {trend}
                    </span>
                )}
            </div>
            <div className="space-y-0.5">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">{label || title}</p>
                <p className="text-3xl font-black text-white tracking-tight">{value || 0}</p>
                {description && <p className="text-[10px] text-white/20 font-medium tracking-tight mt-2">{description}</p>}
            </div>
        </div>
    );
}

function HealthRow({ label, status, latency }) {
    return (
        <div className="flex items-center justify-between group">
            <div className="flex items-center gap-3">
                <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    status === 'online' ? "bg-emerald-400" :
                        status === 'loading' ? "bg-slate-500 animate-pulse" :
                            "bg-red-400 animate-pulse"
                )} />
                <span className="text-[11px] font-bold text-white/70 group-hover:text-white transition-colors uppercase">{label}</span>
            </div>
            <span className="text-[9px] font-mono text-slate-600 tracking-tighter">{latency}</span>
        </div>
    );
}

function ActivityItem({ icon: Icon, title, time, detail, color }) {
    const colorClasses = {
        blue: 'text-blue-400 bg-blue-400/5',
        indigo: 'text-indigo-400 bg-indigo-400/5',
        amber: 'text-amber-400 bg-amber-400/10',
        emerald: 'text-emerald-400 bg-emerald-400/5',
        red: 'text-red-400 bg-red-400/5',
    };

    return (
        <div className="flex gap-4 group">
            <div className={cn("p-2.5 rounded-xl shrink-0 h-fit transition-all group-hover:bg-white/5", colorClasses[color])}>
                <Icon size={14} />
            </div>
            <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-white uppercase tracking-tight">{title}</span>
                    <span className="text-[8px] text-slate-700 font-bold whitespace-nowrap">{time}</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-snug group-hover:text-slate-400 transition-colors truncate">{detail}</p>
            </div>
        </div>
    );
}
