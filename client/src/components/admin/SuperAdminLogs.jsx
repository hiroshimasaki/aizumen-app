import { useState, useEffect, useCallback } from 'react';
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
    Building2,
    AlertTriangle, CheckCircle2, XCircle, ChevronLeft, ChevronRight, ShieldAlert, Database, FileText, Download, Flag, MessageSquare, Trash2
} from 'lucide-react';
import api from '../../lib/api';
import { cn } from '../../lib/utils';

import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { useNotification } from '../../contexts/NotificationContext';

export default function SuperAdminLogs({ pendingReportsCount = 0 }) {
    const [activeTab, setActiveTab] = useState(() => localStorage.getItem('sa_activeTab') || 'errors');

    useEffect(() => {
        localStorage.setItem('sa_activeTab', activeTab);
    }, [activeTab]);

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

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);

    // 違反報告用のステータスフィルタ
    const [reportStatus, setReportStatus] = useState('pending'); // 'all', 'pending', 'resolved', 'ignored'

    const { showAlert, showConfirm } = useNotification();

    useEffect(() => {
        fetchLogs();
    }, [activeTab, page, search, reportStatus, startDate, endDate]);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                limit: 50,
                offset: (page - 1) * 50
            });

            if (search) {
                params.append('search', search);
            }
            if (startDate) {
                params.append('startDate', startDate.toISOString());
            }
            if (endDate) {
                params.append('endDate', endDate.toISOString());
            }

            if (activeTab === 'errors' || activeTab === 'access' || activeTab === 'audit') {
                if (filter.tenantId) params.append('tenantId', filter.tenantId);
                if (filter.source) params.append('source', filter.source);
                if (filter.level) params.append('level', filter.level);
                if (filter.status) params.append('status', filter.status);
                if (filter.action) params.append('action', filter.action);
            }

            if (activeTab === 'reports' && reportStatus !== 'all') {
                params.append('status', reportStatus);
            }

            const endpoint = activeTab === 'reports'
                ? '/api/super-admin/forum/reports'
                : `/api/super-admin/logs/${activeTab}`;

            const { data } = await api.get(`${endpoint}?${params}`);
            setLogs(data || []);
        } catch (err) {
            console.error('Failed to fetch logs:', err);
            showAlert('ログの取得に失敗しました', 'error');
        } finally {
            setLoading(false);
        }
    }, [activeTab, page, search, reportStatus, startDate, endDate, filter, showAlert]);

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

    const exportLogs = async () => {
        try {
            const params = new URLSearchParams({
                search: search || '',
                startDate: startDate ? startDate.toISOString() : '',
                endDate: endDate ? endDate.toISOString() : '',
                tenantId: filter.tenantId || '',
                source: filter.source || '',
                level: filter.level || '',
                status: filter.status || '',
                action: filter.action || '',
                reportStatus: activeTab === 'reports' ? reportStatus : ''
            });
            const endpoint = activeTab === 'reports'
                ? '/api/super-admin/forum/reports/export'
                : `/api/super-admin/logs/${activeTab}/export`;

            const res = await api.get(`${endpoint}?${params}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${activeTab}-logs-${new Date().toISOString()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showAlert('ログをCSVエクスポートしました', 'success');
        } catch (err) {
            console.error('Failed to export logs:', err);
            showAlert('ログのエクスポートに失敗しました', 'error');
        }
    };

    // --- 違反報告のアクション ---
    const updateReportStatus = async (reportId, newStatus) => {
        try {
            await api.patch(`/api/super-admin/forum/reports/${reportId}/status`, { status: newStatus });
            setLogs(prev => prev.map(log =>
                log.id === reportId ? { ...log, status: newStatus } : log
            ));
            showAlert('ステータスを更新しました', 'success');
        } catch (err) {
            console.error(err);
            showAlert('ステータス更新に失敗しました', 'error');
        }
    };

    const deleteTargetContent = async (report) => {
        if (!await showConfirm('強制削除しますか？\n対象コンテンツは削除され、この報告のステータスは「対応済み」になり履歴が残ります。')) return;
        try {
            await api.delete(`/api/super-admin/forum/reports/${report.id}/content`);
            // ステータスをresolvedへ変更し、コンテンツに削除済みの目印をつける
            setLogs(prev => prev.map(log => 
                log.id === report.id 
                    ? { ...log, status: 'resolved', targetContent: `[管理者によって削除されました] ` + (log.targetContent || '') } 
                    : log
            ));
            showAlert('対象コンテンツを削除し、履歴に保存しました', 'success');
        } catch (err) {
            console.error(err);
            showAlert('コンテンツの削除に失敗しました', 'error');
        }
    };

    const renderLogContent = (log) => {
        if (activeTab === 'reports') {
            const statusConfig = {
                pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: '対応待ち' },
                resolved: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: '対応済み' },
                ignored: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: '却下' }
            };
            const s = statusConfig[log.status] || statusConfig.pending;

            return (
                <div key={log.id} className="bg-slate-800/30 border border-white/5 rounded-2xl p-4 transition-all hover:bg-slate-800/50">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${s.bg} ${s.text}`}>
                                {s.label}
                            </span>
                            <div className="text-sm font-bold text-white flex items-center gap-2">
                                <Flag className="w-4 h-4 text-rose-400" />
                                {log.reason}
                            </div>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(log.created_at).toLocaleString('ja-JP')}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        {/* 通報内容 */}
                        <div className="bg-slate-900/50 p-3 rounded-xl border border-white/5">
                            <div className="text-xs text-slate-500 mb-1">報告者: {log.reporter}</div>
                            {log.details && <div className="text-sm text-slate-300 mt-2 p-2 bg-slate-800/50 rounded-lg">{log.details}</div>}
                        </div>
                        {/* 対象コンテンツ */}
                        <div className="bg-rose-950/20 p-3 rounded-xl border border-rose-500/10">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                                    {log.targetType === 'post' ? '投稿' : '返信'}
                                </span>
                                <span className="text-xs text-slate-500">作成者: {log.targetAuthor}</span>
                            </div>
                            <div className="text-sm text-slate-300 line-clamp-3">
                                {log.targetContent || '(コンテンツが取得できませんでした。削除済みの可能性があります)'}
                            </div>
                        </div>
                    </div>

                    {/* アクション */}
                    <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-white/5">
                        {log.status === 'pending' && (
                            <>
                                <button onClick={() => updateReportStatus(log.id, 'ignored')} className="px-3 py-1.5 text-xs font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                                    却下する
                                </button>
                                <button onClick={() => updateReportStatus(log.id, 'resolved')} className="px-3 py-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors">
                                    対応済みにする
                                </button>
                            </>
                        )}
                        {/* 削除ボタンはステータスに関わらず、まだ強制削除のマークがついていない場合のみ表示 */}
                        {log.targetContent && !log.targetContent.includes('[管理者によって削除されました]') && (
                            <button onClick={() => deleteTargetContent(log)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors ms-2">
                                <Trash2 className="w-3.5 h-3.5" /> 対象を強制削除
                            </button>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <LogEntry
                key={log.id}
                log={log}
                type={activeTab}
                isExpanded={expandedLogId === log.id}
                onToggle={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
            />
        );
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
                        <TabButton
                            active={activeTab === 'reports'}
                            onClick={() => setActiveTab('reports')}
                            label="Reports"
                            icon={Flag}
                            color="text-rose-500"
                            badge={pendingReportsCount}
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
                {/* フィルタエリア */}
                <div className="bg-slate-800/30 border border-white/5 rounded-2xl p-4 flex flex-wrap gap-4 items-center">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="キーワード検索..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-2 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-blue-500/50"
                        />
                    </div>

                    {activeTab === 'reports' ? (
                        <select
                            value={reportStatus}
                            onChange={(e) => { setReportStatus(e.target.value); setPage(1); }}
                            className="bg-slate-900/50 border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                        >
                            <option value="all">すべてのステータス</option>
                            <option value="pending">対応待ち</option>
                            <option value="resolved">対応済み</option>
                            <option value="ignored">却下</option>
                        </select>
                    ) : (
                        <div className="flex items-center gap-2">
                            <DatePicker
                                selected={startDate}
                                onChange={(date) => setStartDate(date)}
                                selectsStart
                                startDate={startDate}
                                endDate={endDate}
                                placeholderText="開始日"
                                className="w-32 bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                            />
                            <span className="text-slate-500">-</span>
                            <DatePicker
                                selected={endDate}
                                onChange={(date) => setEndDate(date)}
                                selectsEnd
                                startDate={startDate}
                                endDate={endDate}
                                minDate={startDate}
                                placeholderText="終了日"
                                className="w-32 bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                            />
                        </div>
                    )}

                    <button
                        onClick={exportLogs}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-xl transition-colors shrink-0"
                    >
                        <Download className="w-4 h-4" />
                        CSVエクスポート
                    </button>
                </div>
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
                        {logs.map((log) => renderLogContent(log))}
                    </div>
                )}
            </div>
            {/* Pagination */}
            <div className="flex justify-between items-center px-6 py-3 border-t border-white/5 bg-black/20">
                <button
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1 text-sm text-slate-400 hover:text-white disabled:opacity-50"
                >
                    <ChevronLeft size={16} /> Previous
                </button>
                <span className="text-sm text-slate-400">Page {page}</span>
                <button
                    onClick={() => setPage(prev => prev + 1)}
                    disabled={logs.length < 50} // Assuming 50 is the limit per page
                    className="flex items-center gap-1 text-sm text-slate-400 hover:text-white disabled:opacity-50"
                >
                    Next <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
}

function TabButton({ active, onClick, label, icon: Icon, color, badge }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all relative",
                active ? "bg-white/5 text-white shadow-lg shadow-black/50" : "text-slate-500 hover:text-slate-400"
            )}
        >
            <Icon size={14} className={active ? color : "text-current"} />
            {label}
            {badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 flex items-center justify-center text-[9px] text-white font-bold border-2 border-[#1d1d1d]">
                    {badge}
                </span>
            )}
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
