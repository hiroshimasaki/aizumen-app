import { useState, useEffect } from 'react';
import {
    AlertCircle,
    Activity,
    ShieldCheck,
    Search,
    RefreshCw,
    Filter,
    ChevronDown,
    ChevronUp,
    Terminal,
    Globe,
    Server,
    Clock,
    User,
    Building2
} from 'lucide-react';
import api from '../../lib/api';
import { cn } from '../../lib/utils';

export default function SuperAdminLogs() {
    const [activeTab, setActiveTab] = useState('errors');
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({
        tenantId: '',
        source: '',
        level: '',
        status: '',
        action: ''
    });
    const [expandedLogId, setExpandedLogId] = useState(null);

    useEffect(() => {
        fetchLogs();
    }, [activeTab]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = {
                tenantId: filter.tenantId || undefined,
                source: filter.source || undefined,
                level: filter.level || undefined,
                status: filter.status || undefined,
                action: filter.action || undefined,
                limit: 50
            };
            const endpoint = `/api/super-admin/logs/${activeTab}`;
            const res = await api.get(endpoint, { params });
            setLogs(res.data);
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleString('ja-JP', {
            timeZone: 'Asia/Tokyo',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    return (
        <div className="flex flex-col h-full bg-[#141414] rounded-lg border border-white/5 overflow-hidden shadow-2xl">
            {/* Header & Tabs */}
            <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Terminal size={20} className="text-blue-500" />
                        System Logs
                    </h2>
                    <div className="flex bg-[#1d1d1d] p-1 rounded-lg border border-white/5">
                        <TabButton
                            active={activeTab === 'errors'}
                            onClick={() => setActiveTab('errors')}
                            label="Errors"
                            icon={AlertCircle}
                            color="text-red-500"
                        />
                        <TabButton
                            active={activeTab === 'access'}
                            onClick={() => setActiveTab('access')}
                            label="Access"
                            icon={Activity}
                            color="text-blue-500"
                        />
                        <TabButton
                            active={activeTab === 'audit'}
                            onClick={() => setActiveTab('audit')}
                            label="Audit"
                            icon={ShieldCheck}
                            color="text-emerald-500"
                        />
                    </div>
                </div>
                <button
                    onClick={fetchLogs}
                    className="p-2 hover:bg-white/5 text-slate-400 rounded-lg transition-colors border border-transparent hover:border-white/10"
                >
                    <RefreshCw size={18} className={cn(loading && "animate-spin")} />
                </button>
            </div>

            {/* Filter Bar */}
            <div className="px-6 py-3 border-b border-white/5 bg-black/20 flex flex-wrap gap-4 items-center">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input
                        type="text"
                        placeholder="Filter by Tenant ID..."
                        value={filter.tenantId}
                        onChange={(e) => setFilter({ ...filter, tenantId: e.target.value })}
                        className="pl-9 pr-4 py-1.5 bg-[#1d1d1d] border border-white/10 rounded-md text-xs text-white focus:outline-none focus:border-blue-500 w-48 transition-all"
                    />
                </div>
                {activeTab === 'errors' && (
                    <select
                        value={filter.source}
                        onChange={(e) => setFilter({ ...filter, source: e.target.value })}
                        className="px-3 py-1.5 bg-[#1d1d1d] border border-white/10 rounded-md text-xs text-white focus:outline-none"
                    >
                        <option value="">All Sources</option>
                        <option value="server">Server</option>
                        <option value="client">Client</option>
                    </select>
                )}
                <button
                    onClick={fetchLogs}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-md transition-all active:scale-95"
                >
                    Apply Filter
                </button>
            </div>

            {/* Log List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/40">
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-20 gap-3">
                        <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Fetching Logs...</span>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 gap-4 opacity-40">
                        <Terminal size={48} className="text-slate-500" />
                        <p className="text-sm font-medium text-slate-400">No logs found in this category.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {logs.map((log) => (
                            <LogEntry
                                key={log.id}
                                log={log}
                                type={activeTab}
                                isExpanded={expandedLogId === log.id}
                                onToggle={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function TabButton({ active, onClick, label, icon: Icon, color }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                active ? "bg-white/5 text-white shadow-lg shadow-black/50" : "text-slate-500 hover:text-slate-400"
            )}
        >
            <Icon size={14} className={active ? color : "text-current"} />
            {label}
        </button>
    );
}

function LogEntry({ log, type, isExpanded, onToggle }) {
    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleString('ja-JP', {
            timeZone: 'Asia/Tokyo',
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    };

    const formatFullDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleString('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const getStatusColor = (status) => {
        if (status >= 500) return 'text-red-400';
        if (status >= 400) return 'text-amber-400';
        if (status >= 300) return 'text-blue-400';
        return 'text-emerald-400';
    };

    return (
        <div className={cn(
            "group border-l-2 transition-all hover:bg-white/[0.01]",
            type === 'errors' ? (log.level === 'error' ? 'border-red-500/50' : 'border-amber-500/50') :
                type === 'access' ? 'border-blue-500/30' : 'border-emerald-500/30',
            isExpanded && "bg-white/[0.02]"
        )}>
            <div
                onClick={onToggle}
                className="px-6 py-3 flex items-center gap-4 cursor-pointer select-none"
            >
                <span className="text-[11px] font-mono text-slate-500 w-32 shrink-0">{formatDate(log.created_at)}</span>

                {/* Type specific indicators */}
                {type === 'errors' && (
                    <div className="flex items-center gap-2 w-20 shrink-0">
                        {log.source === 'server' ? <Server size={12} className="text-slate-500" /> : <Globe size={12} className="text-slate-500" />}
                        <span className={cn("text-[10px] font-bold uppercase", log.level === 'error' ? 'text-red-400' : 'text-amber-400')}>{log.level}</span>
                    </div>
                )}

                {type === 'access' && (
                    <div className="flex items-center gap-3 w-40 shrink-0">
                        <span className={cn("text-[11px] font-black w-10", log.method === 'POST' ? 'text-blue-400' : 'text-emerald-400')}>{log.method}</span>
                        <span className={cn("text-[11px] font-mono font-bold", getStatusColor(log.status_code))}>{log.status_code}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{log.duration_ms}ms</span>
                    </div>
                )}

                {type === 'audit' && (
                    <div className="flex items-center gap-2 w-48 shrink-0">
                        <ShieldCheck size={12} className="text-emerald-500" />
                        <span className="text-[10px] font-bold text-white truncate max-w-[150px]">{log.action}</span>
                    </div>
                )}

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-300 truncate group-hover:text-white transition-colors">
                        {type === 'access' ? log.path : (log.message || log.description)}
                    </p>
                </div>

                <div className="flex items-center gap-4 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                    {log.tenants?.name && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded border border-white/5">
                            <Building2 size={10} className="text-slate-500" />
                            <span className="text-[10px] text-slate-400 font-medium">{log.tenants.name}</span>
                        </div>
                    )}
                    {isExpanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="px-6 pb-4 pt-1 ml-32 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="bg-black/40 border border-white/5 rounded p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                            <InfoField icon={Clock} label="Full Timestamp (JST)" value={formatFullDate(log.created_at)} />
                            <InfoField icon={User} label="User ID" value={log.user_id || 'N/A'} />
                            <InfoField icon={Building2} label="Tenant ID" value={log.tenant_id || 'N/A'} />
                            {type === 'access' && <InfoField icon={Globe} label="IP Address" value={log.ip || 'N/A'} />}
                        </div>

                        {log.stack && (
                            <div className="space-y-1.5 mt-4">
                                <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                                    <Terminal size={12} />
                                    Stack Trace
                                </p>
                                <pre className="p-3 bg-red-500/5 text-red-300/80 rounded border border-red-500/10 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                                    {log.stack}
                                </pre>
                            </div>
                        )}

                        {log.browser_info && (
                            <div className="space-y-1.5 mt-4">
                                <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                                    <Globe size={12} />
                                    Browser/OS Info
                                </p>
                                <pre className="p-3 bg-white/5 text-slate-400 rounded border border-white/10 text-[10px] font-mono overflow-x-auto">
                                    {JSON.stringify(log.browser_info, null, 2)}
                                </pre>
                            </div>
                        )}

                        {log.metadata && (
                            <div className="space-y-1.5 mt-4">
                                <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                                    <ShieldCheck size={12} />
                                    Metadata
                                </p>
                                <pre className="p-3 bg-white/5 text-slate-400 rounded border border-white/10 text-[10px] font-mono overflow-x-auto">
                                    {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                            </div>
                        )}

                        {(log.path || log.method) && type !== 'access' && (
                            <div className="flex gap-4 mt-2">
                                <span className="text-[11px] text-slate-500 font-mono"><span className="text-slate-600">Method:</span> {log.method}</span>
                                <span className="text-[11px] text-slate-500 font-mono"><span className="text-slate-600">Path:</span> {log.path}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function InfoField({ icon: Icon, label, value }) {
    return (
        <div className="flex items-center gap-2">
            <Icon size={12} className="text-slate-600" />
            <div className="flex flex-col">
                <span className="text-[9px] text-slate-600 font-black uppercase tracking-wider">{label}</span>
                <span className="text-[11px] text-slate-400 font-mono truncate max-w-[200px]" title={value}>{value}</span>
            </div>
        </div>
    );
}
