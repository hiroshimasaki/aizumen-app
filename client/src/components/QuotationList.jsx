import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FileText, User, Mail, StickyNote, Check, Trash2, Edit2, Printer, CheckCircle, XCircle, Clock, Link as LinkIcon, Activity, Save as SafeIcon, Copy, Sparkles, Download, ArchiveRestore, Trash } from 'lucide-react';
import PdfThumbnail from './PdfThumbnail';
import { cn } from '../lib/utils';
import api from '../lib/api';
import { useNotification } from '../contexts/NotificationContext';

export default function QuotationList({ quotations, onEdit, onCopy, onDelete, onRestore, onPermanentDelete, onStatusUpdate, onPrint, onPrintMaterialOrder, onPrintHeatTreatmentOrder, isAdmin = true, isTrashView = false }) {
    const { tenant } = useAuth();
    const { showAlert } = useNotification();
    const hourlyRate = tenant?.hourly_rate || 8000;

    const [quickEditId, setQuickEditId] = useState(null);
    // ... existing state ...
    const [quickData, setQuickData] = useState([]);
    const [downloadingId, setDownloadingId] = useState(null);

    const startQuickEdit = (quotation) => {
        setQuickEditId(quotation.id);
        setQuickData(quotation.items.map(item => ({
            id: item.id,
            actualHours: item.actualHours || '',
            actualMaterialCost: (item.actualMaterialCost !== undefined && item.actualMaterialCost !== null) ? Math.round(Number(item.actualMaterialCost) * (Number(item.quantity) || 1)) : '',
            actualOtherCost: (item.actualOtherCost !== undefined && item.actualOtherCost !== null) ? Math.round(Number(item.actualOtherCost) * (Number(item.quantity) || 1)) : '',
            actualProcessingCost: (item.actualProcessingCost !== undefined && item.actualProcessingCost !== null) ? Math.round(Number(item.actualProcessingCost) * (Number(item.quantity) || 1)) : '',
            scheduledStartDate: item.scheduledStartDate || ''
        })));
    };

    const handleQuickChange = (itemId, field, value) => {
        setQuickData(prev => prev.map(item => {
            if (item.id === itemId) {
                const newItem = { ...item, [field]: value };
                if (field === 'actualHours') {
                    newItem.actualProcessingCost = value ? Math.round(Number(value) * hourlyRate) : '';
                }
                return newItem;
            }
            return item;
        }));
    };

    const saveQuickEdit = async (quotation) => {
        const updatedItems = quotation.items.map(item => {
            const quickRow = quickData.find(q => q.id === item.id);
            if (!quickRow) return item;

            const qty = Number(item.quantity) || 1;
            return {
                ...item,
                actualHours: quickRow.actualHours,
                actualProcessingCost: (quickRow.actualProcessingCost !== '' && quickRow.actualProcessingCost !== null) ? Number(quickRow.actualProcessingCost) / qty : '',
                actualMaterialCost: (quickRow.actualMaterialCost !== '' && quickRow.actualMaterialCost !== null) ? Number(quickRow.actualMaterialCost) / qty : '',
                actualOtherCost: (quickRow.actualOtherCost !== '' && quickRow.actualOtherCost !== null) ? Number(quickRow.actualOtherCost) / qty : '',
                scheduledStartDate: quickRow.scheduledStartDate
            };
        });

        // 見積更新API呼び出し
        try {
            await api.put(`/api/quotations/${quotation.id}`, { items: updatedItems });
            if (onStatusUpdate) {
                // UI再描画用コールバック
                onStatusUpdate(quotation.id, quotation.status, updatedItems);
            }
            setQuickEditId(null);
        } catch (err) {
            console.error('Failed to save quick edit:', err);
            await showAlert('実績の保存に失敗しました', 'error');
        }
    };

    // ファイルダウンロード処理（署名付きURL取得後）
    const handleFileDownload = async (e, fileId, fileName) => {
        e.preventDefault();
        e.stopPropagation();
        setDownloadingId(fileId);
        try {
            const { data } = await api.get(`/api/files/${fileId}`);
            window.open(data.url, '_blank');
        } catch (err) {
            console.error('File download failed:', err);
            await showAlert('ファイルの取得に失敗しました', 'error');
        } finally {
            setDownloadingId(null);
        }
    };

    if (quotations.length === 0) {
        return (
            <div className="text-center py-20 bg-slate-800/50 rounded-2xl border border-slate-700 border-dashed backdrop-blur-sm">
                <div className="bg-slate-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
                    <FileText className="text-slate-500" size={32} />
                </div>
                <h3 className="text-lg font-medium text-slate-200">案件がありません</h3>
                <p className="text-slate-400 mt-1">新しい案件を登録してください</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {quotations.map((quotation) => {
                // 合計計算
                let total = 0;
                let totalProc = 0;
                let totalMat = 0;
                let totalOther = 0;
                let actualProcTotal = 0;
                let actualMatTotal = 0;
                let actualOtherTotal = 0;
                let hasActuals = false;

                if (quotation.items && quotation.items.length > 0) {
                    quotation.items.forEach(item => {
                        const qty = Number(item.quantity) || 1;
                        const p = (Number(item.processingCost) || 0) * qty;
                        const m = (Number(item.materialCost) || 0) * qty;
                        const o = (Number(item.otherCost) || 0) * qty;

                        totalProc += p;
                        totalMat += m;
                        totalOther += o;
                        total += (p + m + o);

                        const actHours = (Number(item.actualHours) || 0);
                        let actRowProc = Math.round((Number(item.actualProcessingCost) || 0) * qty);

                        // 実績加工費が未入力で、実績時間がある場合のみ、時間から概算する
                        if ((actRowProc <= 0) && actHours > 0) {
                            actRowProc = Math.round(actHours * hourlyRate);
                        }

                        const actMat = (Number(item.actualMaterialCost) || 0) * qty;
                        const actOther = (Number(item.actualOtherCost) || 0) * qty;

                        if (actRowProc > 0 || actMat > 0 || actOther > 0 || actHours > 0) {
                            actualProcTotal += actRowProc;
                            actualMatTotal += actMat;
                            actualOtherTotal += actOther;
                            hasActuals = true;
                        }
                    });
                }

                const actualTotal = actualProcTotal + actualMatTotal + actualOtherTotal;
                const variance = hasActuals ? actualProcTotal - totalProc : 0;
                const variancePercent = hasActuals && totalProc > 0 ? (variance / totalProc) * 100 : 0;
                const isFullyDelivered = quotation.status === 'ordered' && quotation.items?.length > 0 && quotation.items.every(i => !!i.deliveryDate);

                return (
                    <div key={quotation.id}
                        className={cn(
                            "rounded-xl border-2 p-5 shadow-sm hover:shadow-lg transition-all duration-300 border-l-[6px] backdrop-blur-md will-change-transform",
                            isFullyDelivered
                                ? "bg-emerald-950/20 border-emerald-600/50 border-l-emerald-500 shadow-[0_0_20px_-5px_rgba(16,185,129,0.15)]" :
                                quotation.status === 'ordered'
                                    ? "bg-cyan-950/20 border-cyan-800/50 border-l-cyan-500 shadow-[0_0_20px_-5px_rgba(6,182,212,0.15)]" :
                                    quotation.status === 'lost'
                                        ? "bg-slate-800/40 border-slate-700 border-l-slate-600" :
                                        "bg-slate-800/60 border-indigo-900/30 border-l-indigo-500 shadow-[0_0_20px_-5px_rgba(99,102,241,0.1)]"
                        )}
                        style={{ contentVisibility: 'auto', containIntrinsicSize: '200px 400px' }}
                    >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            {/* Left Side: Info */}
                            <div className="space-y-3 flex-1 min-w-0">
                                <div className="space-y-4">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <h3 className="text-xl font-bold text-slate-100 break-words">{quotation.companyName || '（会社名なし）'}</h3>
                                        <span className="text-xs text-slate-500 font-mono">#{quotation.displayId || quotation.id}</span>
                                        {quotation.orderNumber && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-900/40 text-purple-300 border border-purple-800/50">
                                                注文: {quotation.orderNumber}
                                            </span>
                                        )}
                                        {quotation.constructionNumber && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-900/40 text-orange-300 border border-orange-800/50">
                                                工事: {quotation.constructionNumber}
                                            </span>
                                        )}
                                    </div>

                                    {/* Files List */}
                                    <div className="flex flex-col gap-2 pt-2">
                                        {quotation.files && quotation.files.length > 0 && (() => {
                                            const pdfs = quotation.files.filter(f => f.originalName.toLowerCase().endsWith('.pdf'));
                                            const others = quotation.files.filter(f => !f.originalName.toLowerCase().endsWith('.pdf'));
                                            const displayPdfs = pdfs.slice(0, 2);
                                            const remainingPdfs = pdfs.slice(2);
                                            const listFiles = [...remainingPdfs, ...others];

                                            return (
                                                <>
                                                    {displayPdfs.length > 0 && (
                                                        <div className="grid grid-cols-2 gap-4 items-start">
                                                            {displayPdfs.map((file) => (
                                                                <button
                                                                    key={file.id}
                                                                    onClick={(e) => handleFileDownload(e, file.id, file.originalName)}
                                                                    disabled={downloadingId === file.id}
                                                                    className="group flex flex-col items-center gap-1 hover:opacity-80 transition-opacity text-left bg-slate-900/10 rounded-lg p-1 border border-transparent hover:border-slate-700/50"
                                                                >
                                                                    <div className="w-full relative overflow-hidden rounded-md bg-slate-900/40 flex items-center justify-center p-0" style={{ aspectRatio: '1.414 / 1' }}>
                                                                        <PdfThumbnail fileId={file.id} />
                                                                    </div>
                                                                    <span className="text-[10px] text-slate-400 w-full max-w-[500px] truncate text-center flex items-center justify-center gap-1 leading-tight mt-1 bg-slate-900/50 py-1.5 rounded-md px-2">
                                                                        {downloadingId === file.id ? <div className="animate-spin rounded-full h-2 w-2 border-b-2 border-slate-400 mr-1" /> : <Download size={10} />}
                                                                        {file.originalName}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {listFiles.length > 0 && (
                                                        <div className="flex flex-col gap-2 mt-2">
                                                            {listFiles.map((file) => (
                                                                <button
                                                                    key={file.id}
                                                                    onClick={(e) => handleFileDownload(e, file.id, file.originalName)}
                                                                    disabled={downloadingId === file.id}
                                                                    className="group flex items-center gap-3 px-3 py-2 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-700/50 rounded-lg transition-all text-left w-full h-12"
                                                                >
                                                                    <div className="shrink-0 w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-slate-500">
                                                                        {downloadingId === file.id ? (
                                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400" />
                                                                        ) : (
                                                                            <FileText size={18} />
                                                                        )}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-[11px] font-bold text-slate-300 truncate leading-tight">{file.originalName}</div>
                                                                        <div className="text-[9px] text-slate-500 flex items-center gap-1 mt-0.5">
                                                                            <Download size={8} /> クリックでダウンロード
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>

                                    {/* Source Files Reference */}
                                    {quotation.sourceFiles && quotation.sourceFiles.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {quotation.sourceFiles.map((sf, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={(e) => handleFileDownload(e, sf.sourceFileId, sf.originalName)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-blue-900/30 text-blue-400 border border-blue-800/50 hover:bg-blue-900/50 transition-colors"
                                                >
                                                    <Sparkles size={10} />
                                                    <span className="max-w-[150px] truncate">転用元: {sf.originalName}</span>
                                                    <Download size={10} />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <User size={16} className="text-slate-500" />
                                        <span>{quotation.contactPerson || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <Mail size={16} className="text-slate-500 shrink-0" />
                                        {quotation.emailLink ? (
                                            <a href={quotation.emailLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline truncate">
                                                メールを確認
                                            </a>
                                        ) : (
                                            <span className="text-slate-600">-</span>
                                        )}
                                    </div>
                                </div>

                                {quotation.notes && (
                                    <div className="flex items-start gap-2 text-sm text-slate-300 mt-2 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/50">
                                        <StickyNote size={16} className="text-slate-500 mt-0.5 shrink-0" />
                                        <span className="whitespace-pre-wrap">{quotation.notes}</span>
                                    </div>
                                )}

                                {/* Items Summary if available */}
                                {quotation.items && quotation.items.length > 0 && (
                                    <div className="mt-4 pt-3 border-t border-slate-800/50">
                                        <p className="text-xs text-slate-400 font-medium mb-1.5 flex items-center gap-1.5"><Activity size={12} /> 明細 ({quotation.items.length}件):</p>
                                        <ul className="space-y-1.5">
                                            {quotation.items.slice(0, 3).map((item, idx) => (
                                                <li key={item.id || idx} className="text-sm text-slate-300 flex justify-between bg-slate-900/30 p-1.5 rounded border border-slate-800/30">
                                                    <span className="truncate mr-2 flex-grow">
                                                        {item.name}
                                                        {isAdmin && (
                                                            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                                                                <span className="text-[10px] bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded font-medium border border-blue-800/50">加工: ¥{(Number(item.processingCost) || 0).toLocaleString()}</span>
                                                                <span className="text-[10px] bg-emerald-900/40 text-emerald-300 px-1.5 py-0.5 rounded font-medium border border-emerald-800/50">材料: ¥{(Number(item.materialCost) || 0).toLocaleString()}</span>
                                                                {(Number(item.otherCost) > 0) && <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-medium border border-slate-700">他: ¥{(Number(item.otherCost) || 0).toLocaleString()}</span>}
                                                                <span className="text-[10px] text-slate-500 font-medium flex items-center">× {item.quantity || 1}</span>
                                                            </div>
                                                        )}
                                                    </span>
                                                    <span className="text-slate-400 text-xs flex flex-col items-end shrink-0 pl-4 border-l border-slate-800/50">
                                                        {item.responseDate && <span>回答: {item.responseDate}</span>}
                                                        {item.dueDate && <span className="text-orange-400 font-medium">納期: {item.dueDate}</span>}
                                                        {item.deliveryDate ? (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 text-[10px] font-bold mt-1">
                                                                <Check size={10} />
                                                                納品済 ({item.deliveryDate})
                                                            </span>
                                                        ) : (
                                                            item.dueDate && <span className="text-[10px] text-slate-500 mt-1 italic">未納品</span>
                                                        )}
                                                    </span>
                                                </li>
                                            ))}
                                            {quotation.items.length > 3 && (
                                                <li className="text-xs text-slate-500 text-center py-1">他 {quotation.items.length - 3} 件...</li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* Right Side: Actions & Totals */}
                            <div className="flex flex-row flex-wrap md:flex-col items-center md:items-end justify-between gap-4 md:border-l md:border-slate-800/50 md:pl-6 md:min-w-[170px] w-full md:w-auto">
                                <div className="text-right bg-slate-900/30 p-3 rounded-lg border border-slate-800/50 w-full md:w-auto">
                                    {isAdmin ? (
                                        <>
                                            {hasActuals ? (
                                                <>
                                                    <p className="text-xs text-slate-400 font-medium mb-0.5">見積合計(加工費)</p>
                                                    <p className="text-2xl font-black text-slate-200 flex items-center justify-end gap-1 font-mono tracking-tight">
                                                        <span className="text-slate-500 text-sm font-normal">¥</span>
                                                        {totalProc.toLocaleString()}
                                                    </p>
                                                    <div className="mt-2 pt-2 border-t border-slate-800/50">
                                                        <p className="text-[10px] text-indigo-400 font-bold mb-0.5 uppercase tracking-wider">実績合計(加工費)</p>
                                                        <p className="text-xl font-black text-indigo-300 flex items-center justify-end gap-1 font-mono tracking-tight">
                                                            <span className="text-indigo-600/50 text-xs font-normal">¥</span>
                                                            {actualProcTotal.toLocaleString()}
                                                        </p>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-xs text-slate-500 font-medium mb-0.5">見積合計(加工費)</p>
                                                    <p className="text-2xl font-black text-slate-100 flex items-center justify-end gap-1 font-mono tracking-tight">
                                                        <span className="text-slate-600 text-sm font-normal">¥</span>
                                                        {totalProc.toLocaleString()}
                                                    </p>
                                                </>
                                            )}

                                            {/* Variance indicator */}
                                            {hasActuals && (
                                                <div className="mt-3 flex flex-col items-end gap-1.5">
                                                    <div className={cn(
                                                        "text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider",
                                                        variancePercent > 20 ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                                                            variancePercent > 0 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                                                                "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                    )}>
                                                        <div className="flex justify-between w-full">
                                                            <span>実績差異(加工費):</span>
                                                            <span>{Math.round(variancePercent) > 0 ? '+' : ''}{Math.round(variancePercent)}%</span>
                                                        </div>
                                                    </div>
                                                    <p className={cn(
                                                        "text-[10px] font-bold leading-tight",
                                                        variance > 0 ? "text-red-400" : "text-emerald-400"
                                                    )}>
                                                        {variance > 0 ? '加工費超過:' : '加工費内収益:'} ¥{Math.abs(variance).toLocaleString()}
                                                    </p>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-end gap-1 w-full">
                                            {hasActuals && (
                                                <div className="mt-1 bg-indigo-950/40 px-2 py-1.5 rounded border border-indigo-900/50 w-full text-center">
                                                    <p className="text-[10px] text-indigo-400 font-bold tracking-wider">実績入力済</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {/* Registered Dates */}
                                    <div className="mt-3 text-[10px] text-slate-500 text-right space-y-0.5">
                                        <p>登録: {new Date(quotation.createdAt).toLocaleDateString()}</p>
                                        {quotation.updatedAt && (
                                            <p>更新: {new Date(quotation.updatedAt).toLocaleDateString()}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Status Badge */}
                                <div className="flex flex-col items-end gap-2 my-2">
                                    {isTrashView ? (
                                        <div className="px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 border shadow-sm bg-red-900/40 text-red-400 border-red-800/50">
                                            <Trash2 size={16} />
                                            削除済み
                                        </div>
                                    ) : (
                                        <div className={cn(
                                            "px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 border shadow-sm",
                                            quotation.status === 'ordered' ? "bg-emerald-900/40 text-emerald-400 border-emerald-800/50" :
                                                quotation.status === 'lost' ? "bg-slate-800 text-slate-400 border-slate-700" :
                                                    "bg-cyan-900/30 text-cyan-400 border-cyan-800/50"
                                        )}>
                                            {quotation.status === 'ordered' ? <CheckCircle size={16} /> :
                                                quotation.status === 'lost' ? <XCircle size={16} /> :
                                                    <Clock size={16} />}
                                            {quotation.status === 'ordered' ? '受注' :
                                                quotation.status === 'lost' ? '失注' :
                                                    '検討中'}
                                        </div>
                                    )}

                                    {/* Status Actions (Hidden in Trash) */}
                                    {isAdmin && !isTrashView && (
                                        <div className="flex flex-wrap items-center justify-end gap-1 mt-1">
                                            {quotation.status !== 'ordered' && (
                                                <button onClick={() => onStatusUpdate(quotation.id, 'ordered')} className="px-2 py-1 text-[10px] font-bold text-emerald-400 hover:bg-emerald-900/30 rounded border border-emerald-900/50 transition-colors">
                                                    受注にする
                                                </button>
                                            )}
                                            {quotation.status !== 'lost' && (
                                                <button onClick={() => onStatusUpdate(quotation.id, 'lost')} className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-800 rounded border border-slate-700 transition-colors">
                                                    失注にする
                                                </button>
                                            )}
                                            {quotation.status !== 'pending' && (
                                                <button onClick={() => onStatusUpdate(quotation.id, 'pending')} className="px-2 py-1 text-[10px] font-bold text-cyan-400 hover:bg-cyan-900/30 rounded border border-cyan-900/50 transition-colors">
                                                    検討中に戻す
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>


                                <div className="flex items-center gap-1.5 bg-slate-900/50 p-1.5 rounded-full border border-slate-800">
                                    {isTrashView ? (
                                        <>
                                            <button onClick={() => onRestore(quotation.id)} className="p-2 text-emerald-400 hover:bg-emerald-900/50 rounded-full transition-colors flex items-center gap-1 px-3" title="ゴミ箱から復元">
                                                <ArchiveRestore size={16} />
                                                <span className="text-xs font-bold">復元</span>
                                            </button>
                                            <div className="w-[1px] h-4 bg-slate-800" />
                                            <button onClick={() => onPermanentDelete(quotation.id)} className="p-2 text-red-500 hover:bg-red-900/50 rounded-full transition-colors flex items-center gap-1 px-3" title="完全に削除">
                                                <Trash size={16} />
                                                <span className="text-xs font-bold">完全削除</span>
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => onPrint(quotation)} className="p-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-full transition-colors" title="見積書を印刷・PDF出力">
                                                <Printer size={16} />
                                            </button>
                                            {isAdmin && (
                                                <button onClick={() => onPrintMaterialOrder(quotation)} className="p-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-full transition-colors" title="材料注文書を印刷・PDF出力">
                                                    <FileText size={16} className={cn("text-blue-400", quotation.items?.some(i => i.material_metadata?.heatTreatment?.shipToVendor) && "text-red-400")} />
                                                </button>
                                            )}
                                            <button onClick={() => onEdit(quotation)} className="p-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-full transition-colors" title={isAdmin ? "編集" : "詳細表示・実績入力"}>
                                                {isAdmin ? <Edit2 size={16} /> : <FileText size={16} />}
                                            </button>
                                            {isAdmin && (
                                                <button onClick={() => onCopy(quotation)} className="p-2 text-slate-400 hover:bg-blue-900/50 hover:text-blue-400 rounded-full transition-colors" title="この案件を転用して作成 (コピー)">
                                                    <Copy size={16} />
                                                </button>
                                            )}
                                            <button onClick={() => startQuickEdit(quotation)} className={cn("p-2 rounded-full transition-all", quickEditId === quotation.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:bg-indigo-900/50 hover:text-indigo-400")} title="実績をクイック入力">
                                                <Activity size={16} />
                                            </button>
                                            {isAdmin && (
                                                <button onClick={() => onDelete(quotation.id)} className="p-2 text-slate-400 hover:bg-red-900/50 hover:text-red-400 rounded-full transition-colors" title="削除">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Quick Edit Panel */}
                        {quickEditId === quotation.id && (
                            <div className="mt-4 pt-4 border-t border-indigo-900/50 bg-indigo-950/30 -mx-5 px-5 py-4 animate-in slide-in-from-top-4 duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-xs font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                                        <Activity size={14} />
                                        実績クイック入力 <span className="text-[9px] font-bold text-indigo-500 font-sans tracking-normal opacity-70">（※ロット合計で入力）</span>
                                    </h4>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setQuickEditId(null)} className="px-3 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors">
                                            キャンセル
                                        </button>
                                        <button onClick={() => saveQuickEdit(quotation)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded shadow-lg shadow-indigo-500/20 text-[10px] font-bold active:scale-95 transition-all">
                                            <SafeIcon size={12} />
                                            実績を保存
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {quotation.items.map((item) => {
                                        const quickRow = quickData.find(q => q.id === item.id);
                                        return (
                                            <div key={item.id} className="bg-slate-900/80 rounded border border-indigo-900/50 p-3 shadow-sm">
                                                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
                                                    <span className="text-sm font-bold text-slate-200 truncate pr-4">{item.name}</span>
                                                    {isAdmin && (
                                                        <span className="text-[10px] text-slate-500 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">予定: ¥{((Number(item.processingCost || 0) + Number(item.materialCost || 0) + Number(item.otherCost || 0)) * (item.quantity || 1)).toLocaleString()}</span>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-black text-indigo-400 uppercase tracking-wider">着手予定日</label>
                                                        <div className="relative">
                                                            <input
                                                                type="date" value={quickRow?.scheduledStartDate || ''}
                                                                onChange={(e) => handleQuickChange(item.id, 'scheduledStartDate', e.target.value)}
                                                                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700/50 rounded text-sm font-mono text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all h-[34px]"
                                                                style={{ colorScheme: 'dark' }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-black text-indigo-400 uppercase tracking-wider">時間 (1ロット合計)</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number" step="any" value={quickRow?.actualHours || ''}
                                                                onChange={(e) => handleQuickChange(item.id, 'actualHours', e.target.value)}
                                                                className="w-full pl-3 pr-6 py-1.5 bg-slate-950 border border-slate-700/50 rounded text-sm text-right font-mono text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all h-[34px]"
                                                                placeholder="0.0"
                                                            />
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold">h</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-black text-indigo-400 uppercase tracking-wider">材料費 (合計)</label>
                                                        <div className="relative">
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold">¥</span>
                                                            <input
                                                                type="number" value={quickRow?.actualMaterialCost || ''}
                                                                onChange={(e) => handleQuickChange(item.id, 'actualMaterialCost', e.target.value)}
                                                                className="w-full pl-5 pr-3 py-1.5 bg-slate-950 border border-slate-700/50 rounded text-sm text-right font-mono text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all h-[34px]"
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-black text-indigo-400 uppercase tracking-wider">その他 (合計)</label>
                                                        <div className="relative">
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold">¥</span>
                                                            <input
                                                                type="number" value={quickRow?.actualOtherCost || ''}
                                                                onChange={(e) => handleQuickChange(item.id, 'actualOtherCost', e.target.value)}
                                                                className="w-full pl-5 pr-3 py-1.5 bg-slate-950 border border-slate-700/50 rounded text-sm text-right font-mono text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all h-[34px]"
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div >
    );
}
