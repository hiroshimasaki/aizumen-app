import { useState, useEffect } from 'react';
import { Download, FileJson, FileSpreadsheet, ShieldCheck, AlertCircle, Upload, FileUp, CheckCircle, XCircle, HardDrive, RefreshCw, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import { useNotification } from '../../contexts/NotificationContext';
import ImportGuide from './ImportGuide';

export default function DataManagement() {
    const { tenant } = useAuth();
    const { showAlert } = useNotification();
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importResult, setImportResult] = useState(null);

    const [backups, setBackups] = useState([]);
    const [loadingBackups, setLoadingBackups] = useState(true);
    const [triggeringBackup, setTriggeringBackup] = useState(false);
    const [showImportGuide, setShowImportGuide] = useState(false);

    useEffect(() => {
        fetchBackups();
    }, []);

    const fetchBackups = async () => {
        setLoadingBackups(true);
        try {
            const { data } = await api.get('/api/backups');
            setBackups(data);
        } catch (err) {
            console.error('Failed to fetch backups:', err);
        } finally {
            setLoadingBackups(false);
        }
    };

    const handleTriggerBackup = async () => {
        setTriggeringBackup(true);
        try {
            await api.post('/api/backups');
            await fetchBackups();
        } catch (err) {
            console.error('Failed to trigger backup:', err);
            await showAlert('バックアップの作成に失敗しました。', 'error');
        } finally {
            setTriggeringBackup(false);
        }
    };

    const handleDownloadBackup = async (fileName) => {
        try {
            const { data } = await api.get(`/api/backups/${fileName}/download`);
            window.location.href = data.url;
        } catch (err) {
            console.error('Failed to get download url:', err);
            await showAlert('ダウンロードURLの取得に失敗しました。', 'error');
        }
    };

    const handleImportSubmit = async (e) => {
        e.preventDefault();
        if (!importFile) return;

        setImporting(true);
        setImportResult(null);

        const formData = new FormData();
        formData.append('file', importFile);

        try {
            const response = await api.post('/api/import/quotations', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setImportResult({ type: 'success', data: response.data });
            setImportFile(null);
            const fileInput = document.getElementById('import-file-upload');
            if (fileInput) fileInput.value = '';
        } catch (err) {
            console.error('Import failed:', err);
            setImportResult({
                type: 'error',
                message: err.response?.data?.message || 'インポート中にエラーが発生しました。'
            });
        } finally {
            setImporting(false);
        }
    };

    const handleExport = async (format) => {
        setLoading(true);
        try {
            const response = await api.get(`/api/export/quotations?format=${format}`, {
                responseType: 'blob'
            });

            // ブラウザでダウンロードを実行
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const extension = format === 'csv' ? 'csv' : 'json';
            link.setAttribute('download', `quotations_export_${new Date().toISOString().split('T')[0]}.${extension}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

        } catch (err) {
            console.error('Export failed:', err);
            await showAlert('エクスポートに失敗しました。', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* データインポート */}
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 backdrop-blur-sm shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-emerald-500/20 rounded-xl">
                        <Upload className="text-emerald-400" size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-100">データの一括インポート</h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <p className="text-sm text-slate-400">CSVまたはJSONファイルから案件データを一括登録します。</p>
                            <button
                                type="button"
                                onClick={() => setShowImportGuide(true)}
                                className="text-sm text-indigo-400 hover:text-indigo-300 font-bold underline underline-offset-4 decoration-indigo-500/30 hover:decoration-indigo-400 transition-all"
                            >
                                インポート可能なデータ構造を確認
                            </button>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleImportSubmit} className="space-y-4">
                    <div className="flex items-center justify-center w-full">
                        <label htmlFor="import-file-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-700 border-dashed rounded-xl cursor-pointer bg-slate-800/30 hover:bg-slate-800 hover:border-emerald-500/50 transition-all">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <FileUp className="w-8 h-8 mb-3 text-slate-400" />
                                <p className="mb-2 text-sm text-slate-400">
                                    <span className="font-semibold text-emerald-400">クリックしてファイルを選択</span>
                                </p>
                                <p className="text-xs text-slate-500">CSV または JSON (最大 10MB)</p>
                            </div>
                            <input
                                id="import-file-upload"
                                type="file"
                                className="hidden"
                                accept=".csv,.json"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setImportFile(e.target.files[0]);
                                        setImportResult(null);
                                    }
                                }}
                            />
                        </label>
                    </div>

                    {importFile && (
                        <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-700 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <FileSpreadsheet className="text-emerald-400 shrink-0" size={20} />
                                <div className="truncate text-sm text-slate-200 font-medium">{importFile.name}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setImportFile(null);
                                        const el = document.getElementById('import-file-upload');
                                        if (el) el.value = '';
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                >
                                    <XCircle size={18} />
                                </button>
                                <button
                                    type="submit"
                                    disabled={importing}
                                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                                >
                                    {importing ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            処理中...
                                        </>
                                    ) : 'インポート実行'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 結果表示 */}
                    {importResult && (
                        <div className={`p-4 rounded-xl border animate-in slide-in-from-top-2 duration-300 ${importResult.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
                            <div className="flex items-start gap-3">
                                {importResult.type === 'success' ?
                                    <CheckCircle className="text-emerald-400 shrink-0 mt-0.5" size={20} /> :
                                    <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={20} />
                                }
                                <div className="text-sm w-full">
                                    {importResult.type === 'success' ? (
                                        <>
                                            <p className="font-bold text-emerald-300 mb-2">{importResult.data.message}</p>
                                            {importResult.data.errors && importResult.data.errors.length > 0 && (
                                                <div className="mt-2 text-xs text-rose-300 bg-rose-950/40 p-3 rounded-lg border border-rose-500/20">
                                                    <p className="font-bold mb-1.5 flex items-center gap-2">
                                                        <AlertCircle size={12} />
                                                        スキップまたはエラー詳細 ({importResult.data.errors.length}件):
                                                    </p>
                                                    <ul className="list-none space-y-1 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                                                        {importResult.data.errors.map((err, idx) => (
                                                            <li key={idx} className="flex gap-2">
                                                                <span className="opacity-60 whitespace-nowrap">行 {err.row}:</span>
                                                                <span>{err.reason}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <p className="font-bold text-rose-300">{importResult.message}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </form>
            </div>

            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 backdrop-blur-sm shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-blue-500/20 rounded-xl">
                        <Download className="text-blue-400" size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-100">データのエクスポート</h3>
                        <p className="text-sm text-slate-400">登録されている案件データを一括でダウンロードします。</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* CSV Export */}
                    <button
                        onClick={() => handleExport('csv')}
                        disabled={loading}
                        className="flex items-center gap-4 p-5 bg-slate-900/50 border border-slate-700 rounded-xl hover:bg-slate-800 hover:border-blue-500/50 transition-all group active:scale-[0.98] disabled:opacity-50"
                    >
                        <div className="p-3 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                            <FileSpreadsheet className="text-emerald-400" size={28} />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">CSV形式でダウンロード</div>
                            <div className="text-xs text-slate-500">Excel等での確認や分析に最適です (UTF-8)</div>
                        </div>
                    </button>

                    {/* JSON Export */}
                    <button
                        onClick={() => handleExport('json')}
                        disabled={loading}
                        className="flex items-center gap-4 p-5 bg-slate-900/50 border border-slate-700 rounded-xl hover:bg-slate-800 hover:border-indigo-500/50 transition-all group active:scale-[0.98] disabled:opacity-50"
                    >
                        <div className="p-3 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
                            <FileJson className="text-indigo-400" size={28} />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">JSON形式でダウンロード</div>
                            <div className="text-xs text-slate-500">データのバックアップや他システム連携用</div>
                        </div>
                    </button>
                </div>

                <div className="mt-8 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl flex gap-3">
                    <AlertCircle className="text-amber-500 shrink-0" size={20} />
                    <div className="text-sm text-amber-200/80">
                        <p className="font-bold mb-1">注意事項</p>
                        <ul className="list-disc list-inside space-y-1 text-xs opacity-80">
                            <li>論理削除された案件（ゴミ箱の中身）はエクスポート対象に含まれません。</li>
                            <li>添付ファイル（PDF等）自体は含まれません。データ（文字情報）のみの出力となります。</li>
                            <li>データ量が多い場合、ダウンロード開始まで数秒かかることがあります。</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* バックアップ管理 */}
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 backdrop-blur-sm shadow-xl">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-indigo-500/20 rounded-xl shrink-0">
                            <HardDrive className="text-indigo-400" size={24} />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h3 className="text-xl font-bold text-slate-100">バックアップ管理・履歴</h3>
                                <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 text-[11px] font-black rounded-full border border-indigo-500/20 uppercase tracking-wider">
                                    <RefreshCw size={10} className="animate-spin-slow" />
                                    毎日 AM 2:00 自動実行
                                </div>
                                <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-500/10 text-amber-400 text-[11px] font-black rounded-full border border-amber-500/20 uppercase tracking-wider">
                                    <ShieldCheck size={10} />
                                    {tenant?.plan === 'pro' ? '30日間保持' : '7日間保持'}
                                </div>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
                                自動および手動で作成されたバックアップは、作成から{tenant?.plan === 'pro' ? '30日間' : '7日間'}自動で保管されます。
                                JSON形式でダウンロードしてデータの保管や復旧に利用できます。
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleTriggerBackup}
                        disabled={triggeringBackup}
                        className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-black/20 shrink-0 self-start md:self-center"
                    >
                        {triggeringBackup ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        手動バックアップ
                    </button>
                </div>

                <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                    {loadingBackups ? (
                        <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                            <RefreshCw className="w-6 h-6 animate-spin mb-3 text-indigo-400" />
                            <p className="text-sm">ロード中...</p>
                        </div>
                    ) : backups.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            バックアップはまだありません。
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-800 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {backups.map((backup) => (
                                <div key={backup.name} className="flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <FileJson className="text-slate-500 group-hover:text-indigo-400 transition-colors" size={20} />
                                        <div>
                                            <div className="text-sm font-bold text-slate-200">{backup.name}</div>
                                            <div className="text-xs text-slate-500">
                                                作成: {new Date(backup.created_at).toLocaleString('ja-JP')} •
                                                サイズ: {(backup.metadata?.size / 1024).toFixed(1)} KB
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleDownloadBackup(backup.name)}
                                            className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors flex items-center gap-2"
                                            title="ダウンロード"
                                        >
                                            <Download size={18} />
                                            <span className="text-xs font-bold hidden sm:inline">ダウンロード</span>
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (window.confirm('このバックアップを削除してもよろしいですか？')) {
                                                    try {
                                                        await api.delete(`/api/backups/${backup.name}`);
                                                        await fetchBackups();
                                                        showAlert('バックアップを削除しました。', 'success');
                                                    } catch (err) {
                                                        console.error('Failed to delete backup:', err);
                                                        showAlert('バックアップの削除に失敗しました。', 'error');
                                                    }
                                                }
                                            }}
                                            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                            title="削除"
                                        >
                                            <XCircle size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Import Guide Modal */}
            <ImportGuide
                isOpen={showImportGuide}
                onClose={() => setShowImportGuide(false)}
            />
        </div>
    );
}
