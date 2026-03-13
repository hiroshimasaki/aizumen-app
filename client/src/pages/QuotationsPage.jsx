import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Filter, RefreshCw, Database, X, Trash2, ArchiveRestore, Trash, UploadCloud, FileText, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '../lib/utils';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import { useNotification } from '../contexts/NotificationContext';
import { extractPdfText, findPurchaseOrderPage } from '../utils/pdfAnalyzer';
import QuotationList from '../components/QuotationList';
import QuotationForm from '../components/QuotationForm';
import QuotationPrintView from '../components/QuotationPrintView';
import DashboardMetrics from '../components/DashboardMetrics';
import { splitPdf } from '../utils/pdfSplitter';

export default function QuotationsPage() {
    const { isAdmin, tenant, setCredits } = useAuth();
    const { showAlert, showConfirm } = useNotification();

    const [quotations, setQuotations] = useState([]);
    const [allQuotations, setAllQuotations] = useState([]); // For metrics tracking
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [showDeleted, setShowDeleted] = useState(false);

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [filterPeriod, setFilterPeriod] = useState('current'); // 'current' or 'all'

    // Modal state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingData, setEditingData] = useState(null);
    const [printData, setPrintData] = useState(null);

    // Bulk Analyze Modal state
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [bulkFiles, setBulkFiles] = useState([]);
    const [bulkStatuses, setBulkStatuses] = useState({});
    const [isBulkAnalyzing, setIsBulkAnalyzing] = useState(false);
    const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

    const handleLocalFilePreview = (e, file) => {
        e.preventDefault();
        if (!file) return;
        const url = URL.createObjectURL(file);
        window.open(url, '_blank');
    };

    const fetchQuotations = async (showLoading = true, overrides = {}) => {
        if (showLoading) setLoading(true);
        try {
            const currentPage = overrides.hasOwnProperty('page') ? overrides.page : page;
            const currentSearch = overrides.hasOwnProperty('search') ? overrides.search : search;

            const params = new URLSearchParams({ page: currentPage });
            if (currentSearch) params.append('search', currentSearch);
            if (statusFilter) params.append('status', statusFilter);
            if (showDeleted) params.append('showDeleted', 'true');

            const { data } = await api.get(`/api/quotations?${params.toString()}`);
            // ... mapQuote remains the same ...
            const mapQuote = (q) => ({
                id: q.id,
                displayId: q.display_id,
                companyName: q.company_name,
                contactPerson: q.contact_person,
                emailLink: q.email_link,
                notes: q.notes,
                orderNumber: q.order_number,
                constructionNumber: q.construction_number,
                status: q.status,
                createdAt: q.created_at,
                updatedAt: q.updated_at,
                isDeleted: q.is_deleted,
                items: (q.quotation_items || []).map(item => ({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    processingCost: item.processing_cost,
                    materialCost: item.material_cost,
                    otherCost: item.other_cost,
                    responseDate: item.response_date,
                    dueDate: item.due_date,
                    deliveryDate: item.delivery_date,
                    scheduledStartDate: item.scheduled_start_date,
                    actualHours: item.actual_hours,
                    actualProcessingCost: item.actual_processing_cost,
                    actualMaterialCost: item.actual_material_cost,
                    actualOtherCost: item.actual_other_cost,
                })).sort((a, b) => a.sort_order - b.sort_order),
                files: (q.quotation_files || []).map(f => ({
                    id: f.id,
                    originalName: f.original_name,
                })),
                sourceFiles: (q.quotation_source_files || []).map(sf => ({
                    sourceFileId: sf.source_file_id,
                    originalName: sf.original_name,
                }))
            });

            const mapped = data.data.map(mapQuote);
            setQuotations(mapped);
            setTotalPages(data.totalPages);
            setTotalCount(data.total);

            // Fetch all for metrics calculation (only non-deleted)
            // 常に最新の統計を反映するため、全件取得を毎回実行する
            if (!showDeleted) {
                const { data: allData } = await api.get('/api/quotations?limit=1000');
                setAllQuotations(allData.data.map(mapQuote));
            }
        } catch (err) {
            console.error('Failed to fetch quotations:', err);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    useEffect(() => {
        // 一般ユーザーが何らかの方法で showDeleted を true にしようとした場合のガード
        if (!isAdmin && showDeleted) {
            setShowDeleted(false);
        }
        fetchQuotations();

        // リアルタイム更新の購読
        if (!tenant?.id) return;

        const channel = supabase.channel(`quotations_changes_${tenant.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'quotations',
                    filter: `tenant_id=eq.${tenant.id}`
                },
                () => fetchQuotations(false)
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'quotation_items',
                    filter: `tenant_id=eq.${tenant.id}`
                },
                () => fetchQuotations(false)
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'quotation_files',
                    filter: `tenant_id=eq.${tenant.id}`
                },
                () => fetchQuotations(false)
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [page, statusFilter, showDeleted, isAdmin, tenant?.id]);

    // 背景スクロールロック
    useEffect(() => {
        if (isFormOpen || isBulkOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isFormOpen, isBulkOpen]);

    const handleSearchSubmit = (e) => {
        if (e) e.preventDefault();
        setPage(1);
        fetchQuotations(true, { page: 1 });
    };

    const handleClearSearch = () => {
        setSearch('');
        setPage(1);
        fetchQuotations(true, { search: '', page: 1 });
    };

    const handleStatusUpdate = async (id, newStatus, updatedItems = null) => {
        try {
            const payload = { status: newStatus };
            if (updatedItems) payload.items = updatedItems;

            await api.put(`/api/quotations/${id}`, payload);
            fetchQuotations(false); // バックグラウンドで再取得して反映
        } catch (err) {
            console.error('Status update failed:', err);
            await showAlert('ステータス更新に失敗しました', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!await showConfirm('この見積をゴミ箱に移動してもよろしいですか？')) return;
        try {
            await api.delete(`/api/quotations/${id}`);
            fetchQuotations(false);
        } catch (err) {
            console.error('Delete failed:', err);
            await showAlert('削除に失敗しました', 'error');
        }
    };

    const handleRestore = async (id) => {
        try {
            await api.post(`/api/quotations/${id}/restore`);
            fetchQuotations(false);
        } catch (err) {
            console.error('Restore failed:', err);
            await showAlert('復元に失敗しました', 'error');
        }
    };

    const handlePermanentDelete = async (id) => {
        if (!await showConfirm('この見積を完全に削除します。この操作は取り消せません。よろしいですか？')) return;
        try {
            await api.delete(`/api/quotations/${id}/permanent`);
            fetchQuotations(false);
        } catch (err) {
            console.error('Permanent delete failed:', err);
            await showAlert('完全削除に失敗しました', 'error');
        }
    };

    const handleEdit = (quotation) => {
        setEditingData(quotation.id ? quotation : null); // empty parameter {} means new
        setIsFormOpen(true);
    };

    const handleCopy = (quotation) => {
        // コピー時はIDを消し、ステータスを初期化
        // 明細の実績値、日付もリセットする
        const resetItems = (quotation.items || []).map(item => ({
            ...item,
            id: null,
            actualHours: null,
            actualProcessingCost: null,
            actualMaterialCost: null,
            actualOtherCost: null,
            deliveryDate: null,
            dueDate: null,
            responseDate: null,
        }));

        setEditingData({
            ...quotation,
            id: null,
            displayId: null,
            status: 'pending',
            orderNumber: '',
            constructionNumber: '',
            sourceId: quotation.id,
            items: resetItems,
            files: [], // 新規アップロード用ファイルは空にする
            sourceFiles: quotation.files || [], // 既存ファイルを「転用元参照」の初期値として扱う（表示用）
        });
        setIsFormOpen(true);
    };

    const handleFormSubmit = () => {
        setIsFormOpen(false);
        setEditingData(null);
        fetchQuotations(false); // バックグラウンド更新でリストを保持
    };

    const handleFormCancel = () => {
        setIsFormOpen(false);
        setEditingData(null);
    };

    const handlePrint = (quotation) => {
        setPrintData(quotation);
        setTimeout(() => {
            window.print();
        }, 100);
    };

    // Bulk Analyze Handlers
    const onDropBulk = useCallback((acceptedFiles, fileRejections) => {
        setBulkFiles(prev => [...prev, ...acceptedFiles]);
        const initialStatuses = {};
        acceptedFiles.forEach(f => {
            if (!bulkStatuses[f.name]) initialStatuses[f.name] = 'pending';
        });
        setBulkStatuses(prev => ({ ...prev, ...initialStatuses }));

        if (fileRejections.length > 0) {
            const errors = fileRejections.map(rejection => {
                const name = rejection.file.name;
                const error = rejection.errors[0]?.code === 'file-invalid-type'
                    ? '一括解析はPDFのみ対応しています'
                    : rejection.errors[0]?.message;
                return `${name}: ${error}`;
            });
            showAlert(`一部のファイルを追加できませんでした：\n${errors.join('\n')}`, 'error');
        }
    }, [bulkStatuses, showAlert]);

    const { getRootProps: getBulkRootProps, getInputProps: getBulkInputProps, isDragActive: isBulkDragActive } = useDropzone({
        onDrop: onDropBulk,
        accept: {
            'application/pdf': ['.pdf']
        }
    });

    const removeBulkFile = (idx) => {
        setBulkFiles(prev => prev.filter((_, i) => i !== idx));
    };

    const shouldStopRef = useRef(false);

    const handleStartBulkAnalyze = async () => {
        console.log('>>> [BulkAnalysis] handleStartBulkAnalyze TRIGGERED');
        if (bulkFiles.length === 0) return;

        setIsBulkAnalyzing(true);
        shouldStopRef.current = false;
        setBulkProgress({ current: 0, total: bulkFiles.length });
        let successCount = 0;

        for (let i = 0; i < bulkFiles.length; i++) {
            if (shouldStopRef.current) break;

            const file = bulkFiles[i];
            if (bulkStatuses[file.name] === 'completed') {
                setBulkProgress(p => ({ ...p, current: p.current + 1 }));
                continue;
            }

            if (!file.name.toLowerCase().endsWith('.pdf')) {
                setBulkStatuses(prev => ({ ...prev, [file.name]: 'error' }));
                continue;
            }

            console.log(`>>> [BulkAnalysis] Starting file: ${file.name}`);
            setBulkStatuses(prev => ({ ...prev, [file.name]: 'analyzing' }));

            try {
                // 1. Analyze OCR
                const ocrFormData = new FormData();
                ocrFormData.append('file', file);
                const { data: ocrData } = await api.post('/api/ocr/analyze', ocrFormData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    timeout: 180000 // 3分 (一括解析・長大ファイル対策)
                });

                // クレジット残高を更新
                if (ocrData.creditStats) {
                    setCredits(prev => ({
                        ...prev,
                        balance: ocrData.creditStats.remainingBalance,
                        purchased_balance: ocrData.creditStats.purchasedBalance !== undefined ? ocrData.creditStats.purchasedBalance : prev.purchased_balance
                    }));
                }

                // 2. Map AI Result to Quotation Payload
                const items = (ocrData.items && ocrData.items.length > 0)
                    ? ocrData.items.map(aiItem => ({
                        name: aiItem.name || file.name.split('.')[0],
                        quantity: aiItem.quantity || 1,
                        processingCost: aiItem.processingCost || aiItem.price || 0,
                        materialCost: aiItem.materialCost || 0,
                        otherCost: aiItem.otherCost || 0,
                        dueDate: aiItem.dueDate || ''
                    }))
                    : [{
                        name: file.name.split('.')[0],
                        quantity: 1,
                        processingCost: 0,
                        materialCost: 0,
                        otherCost: 0,
                        dueDate: ''
                    }];

                const quotationPayload = {
                    companyName: ocrData.companyName || '自動作成（一括解析）',
                    orderNumber: ocrData.orderNumber || '',
                    constructionNumber: ocrData.constructionNumber || '',
                    status: 'ordered',
                    notes: ocrData.notes || '',
                    items: items
                };

                // 重複チェック (注文番号のみ)
                if (quotationPayload.orderNumber) {
                    const { data: dups } = await api.get('/api/quotations/check-duplicate', {
                        params: {
                            orderNumber: quotationPayload.orderNumber
                        }
                    });
                    if (dups.duplicate) {
                        const confirmMsg = `【重複の可能性】${file.name}の解析結果（注文番号: ${quotationPayload.orderNumber}）は既存の案件（${dups.matches[0].displayId}）と重複しています。登録を続けますか？`;
                        if (!window.confirm(confirmMsg)) {
                            setBulkStatuses(prev => ({ ...prev, [file.name]: 'error' }));
                            continue;
                        }
                    }
                }

                const { data: newQuote } = await api.post('/api/quotations', quotationPayload);

                // 4. Split and Upload Files
                if (newQuote && newQuote.id) {
                    console.log('[BulkAnalysis] OCR Data:', ocrData);
                    const formData = new FormData();
                    formData.append('quotationId', newQuote.id);

                    const orderFormPages = (ocrData.pageClassifications || [])
                        .filter(p => p.type === 'order_form').map(p => p.page);
                    const drawingPages = (ocrData.pageClassifications || [])
                        .filter(p => p.type === 'drawing').map(p => p.page);

                    console.log('[BulkAnalysis] Split Decision:', { orderFormPages, drawingPages });

                    const suffix = quotationPayload.orderNumber ? `_${quotationPayload.orderNumber}` : '';
                    let splitUploaded = false;
                    
                    if (orderFormPages.length > 0) {
                        console.log('[BulkAnalysis] Splitting Order Form:', orderFormPages);
                        const blob = await splitPdf(file, orderFormPages);
                        if (blob) {
                            formData.append('files', new File([blob], `注文書${suffix}.pdf`, { type: 'application/pdf' }));
                            splitUploaded = true;
                        }
                    }
                    if (drawingPages.length > 0) {
                        const blob = await splitPdf(file, drawingPages);
                        if (blob) {
                            formData.append('files', new File([blob], `図面${suffix}.pdf`, { type: 'application/pdf' }));
                            splitUploaded = true;
                        }
                    }

                    if (!splitUploaded) formData.append('files', file);

                    await api.post('/api/files/upload', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                }

                setBulkStatuses(prev => ({ ...prev, [file.name]: 'completed' }));
                successCount++;
            } catch (err) {
                console.error(`>>> [BulkAnalysis] Error processing bulk file ${file.name}:`, err);
                if (err.response) {
                    console.error('>>> [BulkAnalysis] API Error Response:', err.response.data);
                }
                setBulkStatuses(prev => ({ ...prev, [file.name]: 'error' }));
            }

            if (shouldStopRef.current) break;
            setBulkProgress(p => ({ ...p, current: p.current + 1 }));
        }

        setIsBulkAnalyzing(false);
        fetchQuotations(false); // Refresh dashboard in background

        if (shouldStopRef.current) return;

        if (successCount === bulkFiles.length) {
            setTimeout(async () => {
                await showAlert(`全 ${bulkFiles.length} 件の解析と案件登録が完了しました。`, 'success');
                setIsBulkOpen(false);
                setBulkFiles([]);
                setBulkStatuses({});
            }, 300);
        } else {
            await showAlert(`処理が完了しましたが、一部エラーが発生しました。一覧をご確認ください。`, 'error');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">
            {/* Dashboard Metrics (Now integrated into QuotationsPage) - Only for Admins */}
            {isAdmin && (
                <div className="relative">
                    <div className="flex justify-end mb-2">
                        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-1 flex gap-1 shadow-lg">
                            <button
                                onClick={() => setFilterPeriod('current')}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-xs font-black transition-all",
                                    filterPeriod === 'current' ? "bg-indigo-600 text-white shadow-indigo-500/20 shadow-lg" : "text-slate-500 hover:text-slate-300"
                                )}
                            >
                                今月
                            </button>
                            <button
                                onClick={() => setFilterPeriod('all')}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-xs font-black transition-all",
                                    filterPeriod === 'all' ? "bg-indigo-600 text-white shadow-indigo-500/20 shadow-lg" : "text-slate-500 hover:text-slate-300"
                                )}
                            >
                                全期間
                            </button>
                        </div>
                    </div>
                    <DashboardMetrics 
                        quotations={allQuotations} 
                        hourlyRate={tenant?.hourly_rate || 8000} 
                        filterMonth={filterPeriod}
                    />
                </div>
            )}

            {/* Header & Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/50 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <Database className="text-indigo-400" size={32} />
                        案件一覧
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">全 {totalCount} 件の案件があります</p>
                </div>
                {isAdmin && (
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsBulkOpen(true)}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all hover:scale-105 active:scale-95 border border-amber-400/30"
                            title="複数の図面を一括で解析して自動登録します"
                        >
                            <Sparkles size={20} className="text-white" />
                            一括解析
                        </button>
                        <button
                            onClick={() => handleEdit({})}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95"
                        >
                            <Plus size={20} />
                            新規作成
                        </button>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <form onSubmit={handleSearchSubmit} className="flex-1 relative flex items-center">
                    <button
                        type="submit"
                        className="absolute left-4 p-1.5 text-slate-500 hover:text-white transition-colors rounded-full hover:bg-slate-700/50"
                        title="検索を実行"
                    >
                        <Search size={20} />
                    </button>
                    <input
                        type="text"
                        placeholder="会社名、注文・工事番号、担当者、品名、備考 (スペースでAND検索)"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-12 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={handleClearSearch}
                            className="absolute right-4 p-1.5 text-slate-500 hover:text-white transition-colors rounded-full hover:bg-slate-700/50"
                            title="検索をクリア"
                        >
                            <X size={20} />
                        </button>
                    )}
                </form>
                <div className="flex items-center flex-wrap gap-3">
                    {isAdmin && (
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-1 flex text-xs">
                            <button
                                onClick={() => { setShowDeleted(false); setPage(1); }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${!showDeleted
                                    ? 'bg-slate-700 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                                    }`}
                            >
                                <Database size={16} />
                                案件一覧
                            </button>
                            <button
                                onClick={() => { setShowDeleted(true); setPage(1); }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${showDeleted
                                    ? 'bg-red-900/40 text-red-200 shadow-sm border border-red-500/30'
                                    : 'text-slate-400 hover:text-red-400/80 hover:bg-red-900/10'
                                    }`}
                            >
                                <Trash2 size={16} />
                                ゴミ箱
                            </button>
                        </div>
                    )}

                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-1 flex flex-wrap gap-1">
                        {['', 'pending', 'ordered', 'delivered', 'unentered_actuals', 'lost'].map(status => (
                            <button
                                key={status}
                                disabled={showDeleted}
                                onClick={() => { setStatusFilter(status); setPage(1); }}
                                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${showDeleted
                                    ? 'text-slate-500 opacity-50 cursor-not-allowed'
                                    : statusFilter === status
                                        ? 'bg-slate-700 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                                    }`}
                            >
                                {status === '' ? 'すべて' :
                                    status === 'pending' ? '検討中' :
                                        status === 'ordered' ? '受注' :
                                            status === 'delivered' ? '納品済' :
                                                status === 'unentered_actuals' ? '実績未入力' :
                                                    '失注'}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => fetchQuotations()}
                        className="p-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
                        title="更新"
                    >
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Trash Retention Notice */}
            {showDeleted && (
                <div className="flex items-center gap-3 px-5 py-3 bg-red-900/20 border border-red-800/40 rounded-xl text-red-300 text-sm font-medium">
                    <Trash2 size={18} className="text-red-400 shrink-0" />
                    <span>ゴミ箱内の案件は <strong>削除から30日後</strong> に自動的に完全削除されます。復元する場合はお早めにお願いします。</span>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                    <p className="animate-pulse">案件データを読み込み中...</p>
                </div>
            ) : (
                <QuotationList
                    quotations={quotations}
                    isAdmin={isAdmin}
                    onStatusUpdate={handleStatusUpdate}
                    onDelete={handleDelete}
                    onRestore={handleRestore}
                    onPermanentDelete={handlePermanentDelete}
                    onEdit={handleEdit}
                    onCopy={handleCopy}
                    onPrint={handlePrint}
                    isTrashView={showDeleted}
                />
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 pt-6 pb-12">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors font-medium"
                    >
                        前へ
                    </button>
                    <span className="px-4 text-slate-400 font-medium">
                        {page} / {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors font-medium"
                    >
                        次へ
                    </button>
                </div>
            )}

            {/* Print View (Only visible during print) */}
            {printData && (
                <QuotationPrintView quotation={printData} companyInfo={tenant} />
            )}

            {/* Quotation Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-[75] flex items-start justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto pt-10 pb-20">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl animate-in zoom-in-95 duration-200 p-6 sm:p-8 relative">
                        <button
                            onClick={handleFormCancel}
                            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors z-10"
                        >
                            <X size={24} />
                        </button>
                        <h2 className="text-2xl font-bold text-white mb-6">
                            {editingData?.id ? '見積・案件の編集' : '新規案件登録'}
                        </h2>
                        <QuotationForm
                            initialData={editingData}
                            onSubmit={handleFormSubmit}
                            onCancel={handleFormCancel}
                            isAdmin={isAdmin}
                        />
                    </div>
                </div>
            )}

            {/* Bulk Analyze Modal */}
            {isBulkOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Sparkles size={22} className="text-amber-500" />
                                <h3 className="text-lg font-black text-white">一括AI解析</h3>
                            </div>
                            <button onClick={() => { shouldStopRef.current = true; setIsBulkOpen(false); if (!isBulkAnalyzing) { setBulkFiles([]); setBulkStatuses({}); } }}
                                className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-5 flex-1 overflow-y-auto space-y-4">
                            {/* Dropzone */}
                            <div {...getBulkRootProps()}
                                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${isBulkDragActive ? 'border-amber-500 bg-amber-900/10' : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'}`}
                            >
                                <input {...getBulkInputProps()} />
                                <UploadCloud size={32} className="mx-auto text-slate-500 mb-3" />
                                <p className="text-slate-400 text-sm font-medium">ここにPDFファイルをドロップ</p>
                                <p className="text-slate-500 text-xs mt-1">対応形式: .pdf (1ファイル 10MB / 合計 20MB)</p>
                            </div>

                            {/* File List */}
                            {bulkFiles.length > 0 && (
                                <div className="space-y-2">
                                    {bulkFiles.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between px-4 py-3 bg-slate-800 rounded-xl border border-slate-700">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <FileText size={18} className="text-slate-500 shrink-0" />
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleLocalFilePreview(e, file)}
                                                    className="text-sm text-amber-400 hover:text-amber-300 hover:underline truncate transition-colors text-left font-medium"
                                                    title="追加したファイルをプレビュー"
                                                >
                                                    {file.name}
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {bulkStatuses[file.name] === 'analyzing' && (
                                                    <div className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                                                )}
                                                {bulkStatuses[file.name] === 'completed' && (
                                                    <CheckCircle2 size={18} className="text-emerald-500" />
                                                )}
                                                {bulkStatuses[file.name] === 'error' && (
                                                    <AlertCircle size={18} className="text-red-500" />
                                                )}
                                                {(!bulkStatuses[file.name] || bulkStatuses[file.name] === 'pending') && (
                                                    <button onClick={() => removeBulkFile(idx)} className="p-1 hover:bg-slate-700 rounded-lg transition-colors">
                                                        <X size={14} className="text-slate-500" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-5 border-t border-slate-800 flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500">{bulkFiles.length} ファイル選択中</span>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => { shouldStopRef.current = true; setIsBulkOpen(false); if (!isBulkAnalyzing) { setBulkFiles([]); setBulkStatuses({}); } }}
                                        className="px-5 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-700 transition-all"
                                    >
                                        閉じる
                                    </button>
                                    <button
                                        onClick={handleStartBulkAnalyze}
                                        disabled={bulkFiles.length === 0 || Object.values(bulkStatuses).some(s => s === 'analyzing')}
                                        className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed hover:from-amber-400 hover:to-orange-400 transition-all"
                                    >
                                        解析開始
                                    </button>
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-500 text-right leading-relaxed">
                                ※ 1ファイルにつき 1クレジット消費（重複チェックによるアラーム時も消費されます）
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

