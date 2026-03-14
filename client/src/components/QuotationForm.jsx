import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, X, Save, DollarSign, User, Plus, Trash2, Calendar, Link as LinkIcon, StickyNote, Sparkles, AlertCircle, Download, Search, RefreshCw, Activity, Calculator } from 'lucide-react';
import { cn } from '../lib/utils';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import PdfEditorModal from './PdfEditorModal';
import DrawingSearchModal from './DrawingSearchModal';
import { splitPdf } from '../utils/pdfSplitter';
import MaterialCostCalcModal from './MaterialCostCalcModal';
export default function QuotationForm({ initialData, onSubmit, onCancel, onPrintMaterialOrder, isAdmin = true }) {
    const { credits, setCredits } = useAuth();
    const { showAlert, showConfirm } = useNotification();
    const quotationId = initialData?.id;

    const handleFileDownload = async (e, fileId, fileName) => {
        e.preventDefault();
        try {
            const response = await api.get(`/api/files/${fileId}`);
            const link = document.createElement('a');
            link.href = response.data.url;
            link.setAttribute('target', '_blank');
            link.setAttribute('download', fileName || response.data.originalName);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Download failed:', err);
            await showAlert('ファイルのダウンロードに失敗しました。', 'error');
        }
    };

    const handleLocalFilePreview = (e, file) => {
        e.preventDefault();
        if (!file) return;
        const url = URL.createObjectURL(file);
        window.open(url, '_blank');
        // Note: In long-lived apps you'd revoke this, but for a simple preview it's acceptable.
    };
    const [headerData, setHeaderData] = useState({
        companyName: '',
        contactPerson: '',
        emailLink: '',
        orderNumber: '',
        constructionNumber: '',
        notes: '',
        status: 'pending',
    });

    const [items, setItems] = useState([
        { id: Date.now(), name: '', dimensions: '', processingCost: '', materialCost: '', otherCost: '', quantity: 1, responseDate: '', dueDate: '', deliveryDate: '', scheduledStartDate: '', scheduledEndDate: '' }
    ]);

    const [files, setFiles] = useState([]); // 新規追加用ファイルオブジェクトの配列
    const [existingFiles, setExistingFiles] = useState([]); // 既存のファイルの配列
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [fileStatuses, setFileStatuses] = useState({}); // { [fileName]: 'pending' | 'analyzing' | 'completed' | 'error' }
    const [companySuggestions, setCompanySuggestions] = useState([]);
    const [duplicates, setDuplicates] = useState({ orderNumber: null, constructionNumber: null });
    const [pastItemSearch, setPastItemSearch] = useState({ isOpen: false, query: '', results: [], targetItemId: null, isLoading: false });
    const [pendingCopyFiles, setPendingCopyFiles] = useState([]);
    const [sourceQuotationView, setSourceQuotationView] = useState(null);
    const [pdfEditorState, setPdfEditorState] = useState({ isOpen: false, fileIndex: null, file: null });
    const [searchModalState, setSearchModalState] = useState({ isOpen: false, fileIndex: null, file: null, isExisting: false });
    const [searchCache, setSearchCache] = useState({}); // { [fileId/name]: results }
    const [queryCache, setQueryCache] = useState({});   // { [fileId/name]: queryPreview (blob url) }
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState([]);
    const [calcModalState, setCalcModalState] = useState({ isOpen: false, targetItemId: null });
    const notesRef = useRef(null);

    // Auto-resize notes textarea
    useEffect(() => {
        if (notesRef.current) {
            notesRef.current.style.height = 'auto';
            notesRef.current.style.height = `${notesRef.current.scrollHeight}px`;
        }
    }, [headerData.notes]);

    // Duplicate Check logic
    useEffect(() => {
        const checkDuplicates = async () => {
            if (!headerData.orderNumber && !headerData.constructionNumber) {
                setDuplicates({ orderNumber: null, constructionNumber: null });
                return;
            }

            try {
                const params = new URLSearchParams();
                if (headerData.orderNumber) params.append('orderNumber', headerData.orderNumber);
                if (quotationId) params.append('excludeId', quotationId);

                const { data } = await api.get(`/api/quotations/check-duplicate?${params.toString()}`);

                const orderMatch = data.matches.find(m => m.orderNumber === headerData.orderNumber);

                setDuplicates({
                    orderNumber: orderMatch || null,
                    constructionNumber: null
                });
            } catch (err) {
                console.error('Duplicate check failed:', err);
            }
        };

        const timer = setTimeout(checkDuplicates, 500);
        return () => clearTimeout(timer);
    }, [headerData.orderNumber, headerData.constructionNumber, quotationId]);

    useEffect(() => {
        // Fetch companies for suggestions
        api.get('/api/companies')
            .then(res => setCompanySuggestions(res.data))
            .catch(err => console.error('Failed to fetch companies', err));

        if (initialData) {
            setHeaderData({
                companyName: initialData.companyName || '',
                contactPerson: initialData.contactPerson || '',
                emailLink: initialData.emailLink || '',
                orderNumber: initialData.orderNumber || '',
                constructionNumber: initialData.constructionNumber || '',
                notes: initialData.notes || '',
                status: initialData.status || 'pending',
            });

            setItems(initialData.items.map(item => ({
                ...item,
                id: item.id || Date.now() + Math.random(),
                // スネークケースをキャメルケースに正規化（保存時の消失を防ぐ）
                processingCost: item.processingCost ?? item.processing_cost ?? '',
                materialCost: item.materialCost ?? item.material_cost ?? '',
                otherCost: item.otherCost ?? item.other_cost ?? '',
                actualHours: item.actualHours ?? item.actual_hours ?? '',
                actualProcessingCost: item.actualProcessingCost ?? item.actual_processing_cost ?? '',
                actualMaterialCost: item.actualMaterialCost ?? item.actual_material_cost ?? '',
                actualOtherCost: item.actualOtherCost ?? item.actual_other_cost ?? '',
                responseDate: item.responseDate ?? item.response_date ?? '',
                scheduledStartDate: item.scheduledStartDate ?? item.scheduled_start_date ?? '',
                scheduledEndDate: item.scheduledEndDate ?? item.scheduled_end_date ?? '',
                dueDate: item.dueDate ?? item.due_date ?? '',
                deliveryDate: item.deliveryDate ?? item.delivery_date ?? '',
                dimensions: item.dimensions || ''
            })));
            if (initialData.files && initialData.files.length > 0) {
                setExistingFiles(initialData.files);
            }
            if (initialData.sourceFiles && initialData.sourceFiles.length > 0) {
                setPendingCopyFiles(initialData.sourceFiles);
            }
            if (initialData.quotation_history) {
                setHistory(initialData.quotation_history);
            }
        }
    }, [initialData]);

    // 履歴の追加取得（一覧からきた場合は history がないので取得する）
    useEffect(() => {
        if (quotationId) {
            api.get(`/api/quotations/${quotationId}`)
                .then(res => {
                    if (res.data.quotation_history) {
                        setHistory(res.data.quotation_history);
                    }
                })
                .catch(err => console.error('Failed to fetch history:', err));
        }
    }, [quotationId]);

    const onDrop = useCallback((acceptedFiles, fileRejections) => {
        setFiles(prev => [...prev, ...acceptedFiles]);

        if (fileRejections.length > 0) {
            const errors = fileRejections.map(rejection => {
                const name = rejection.file.name;
                const error = rejection.errors[0]?.code === 'file-invalid-type'
                    ? '未対応の形式です'
                    : rejection.errors[0]?.message;
                return `${name}: ${error}`;
            });
            showAlert(`一部のファイルを追加できませんでした：\n${errors.join('\n')}`, 'error');
        }
    }, [showAlert]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/dxf': ['.dxf'],
            'image/vnd.dxf': ['.dxf'],
            'text/x-dxf': ['.dxf'],
            'application/step': ['.step', '.stp'],
            'model/step': ['.step', '.stp'],
            'application/octet-stream': ['.dxf', '.step', '.stp']
        },
        multiple: true
    });

    const removeNewFile = (indexToRemove) => setFiles(prev => prev.filter((_, i) => i !== indexToRemove));
    const removeExistingFile = (idToRemove) => setExistingFiles(prev => prev.filter(f => f.id !== idToRemove));

    const handleHeaderChange = (e) => {
        const { name, value } = e.target;
        setHeaderData(prev => ({ ...prev, [name]: value }));
    };

    const handleItemChange = (id, field, value) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const addItem = () => {
        setItems(prev => [...prev, {
            id: Date.now(), name: '', dimensions: '', processingCost: '', materialCost: '', otherCost: '', quantity: 1, responseDate: '', dueDate: '', deliveryDate: '', scheduledStartDate: ''
        }]);
    };

    const removeItem = (id) => {
        if (items.length > 1) setItems(prev => prev.filter(item => item.id !== id));
    };

    const handleSearchPastItems = async (query) => {
        if (!query) return;
        setPastItemSearch(prev => ({ ...prev, isLoading: true }));
        try {
            const { data } = await api.get(`/api/quotations/items/search?q=${encodeURIComponent(query)}`);
            setPastItemSearch(prev => ({ ...prev, results: data || [], isLoading: false }));
        } catch (err) {
            console.error('Failed to search past items', err);
            // Optionally could show a toast or alert
            setPastItemSearch(prev => ({ ...prev, isLoading: false }));
        }
    };

    const handleApplyPastItem = (pastItem) => {
        const targetId = pastItemSearch.targetItemId;
        if (!targetId) return;

        setItems(prev => prev.map(item => {
            if (item.id === targetId) {
                return {
                    ...item,
                    name: pastItem.name,
                    processingCost: pastItem.processing_cost || '',
                    materialCost: pastItem.material_cost || '',
                    otherCost: pastItem.other_cost || '',
                    dimensions: pastItem.dimensions || ''
                };
            }
            return item;
        }));

        if (pastItem.quotations?.quotation_files && pastItem.quotations.quotation_files.length > 0) {
            setPendingCopyFiles(prev => {
                const newFiles = [...prev];
                pastItem.quotations.quotation_files.forEach(f => {
                    if (!newFiles.some(existing => existing.sourceFileId === f.id)) {
                        newFiles.push({
                            sourceFileId: f.id,
                            originalName: f.original_name
                        });
                    }
                });
                return newFiles;
            });
        }

        setPastItemSearch({ isOpen: false, query: '', results: [], targetItemId: null, isLoading: false });
    };

    const handleAIAnalyze = async (file) => {
        if (!credits || credits.balance <= 0) {
            await showAlert('AI解析クレジットが不足しています。', 'error');
            return;
        }

        setFileStatuses(prev => ({ ...prev, [file.name]: 'analyzing' }));
        setIsAnalyzing(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const { data } = await api.post('/api/ocr/analyze', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 180000 // 3分 (一括処理や巨大PDF対策)
            });

            // クレジット残高を更新
            if (setCredits && data.creditStats) {
                setCredits(prev => ({
                    ...prev,
                    balance: data.creditStats.remainingBalance,
                    purchased_balance: data.creditStats.purchasedBalance !== undefined ? data.creditStats.purchasedBalance : prev.purchased_balance
                }));
            }

            // 解析結果の反映 (ヘッダー情報)
            setHeaderData(prev => ({
                ...prev,
                companyName: data.companyName || prev.companyName,
                orderNumber: data.orderNumber || prev.orderNumber,
                constructionNumber: data.constructionNumber || prev.constructionNumber,
                notes: data.notes ? (prev.notes ? `${prev.notes}\n${data.notes}` : data.notes) : prev.notes
            }));

            // 明細の反映
            if (data.items && data.items.length > 0) {
                setItems(prev => {
                    const newItems = [...prev];
                    data.items.forEach((aiItem, idx) => {
                        const mappedItem = {
                            id: Date.now() + idx + Math.random(),
                            name: aiItem.name || '',
                            quantity: aiItem.quantity || 1,
                            processingCost: aiItem.processingCost || aiItem.price || '',
                            materialCost: aiItem.materialCost || '',
                            otherCost: aiItem.otherCost || '',
                            responseDate: '',
                            dueDate: aiItem.dueDate || '',
                            dimensions: aiItem.dimensions || '',
                            deliveryDate: '',
                            scheduledStartDate: ''
                        };

                        // 最初のアイテムで、かつ現在の1行目が空なら上書き
                        const emptyIdx = newItems.findIndex(item => !item.name && !item.processingCost);
                        if (emptyIdx !== -1) {
                            newItems[emptyIdx] = mappedItem;
                        } else {
                            newItems.push(mappedItem);
                        }
                    });
                    return newItems;
                });
            }

            setFileStatuses(prev => ({ ...prev, [file.name]: 'completed' }));

            // --- PDF 分割ロジックの追加 ---
            if (data.pageClassifications && data.pageClassifications.length > 0) {
                console.log('[AIAnalyze] Split Decision Started:', data.pageClassifications);
                
                const orderFormPages = data.pageClassifications
                    .filter(p => p.type === 'order_form').map(p => p.page);
                const drawingPages = data.pageClassifications
                    .filter(p => p.type === 'drawing').map(p => p.page);

                const suffix = data.orderNumber ? `_${data.orderNumber}` : '';
                const newFilesToAdd = [];

                if (orderFormPages.length > 0) {
                    const blob = await splitPdf(file, orderFormPages);
                    if (blob) {
                        console.log(`[AIAnalyze] Order Form Blob size: ${blob.size}`);
                        newFilesToAdd.push(new File([blob], `注文書${suffix}.pdf`, { type: 'application/pdf' }));
                    }
                }
                if (drawingPages.length > 0) {
                    const blob = await splitPdf(file, drawingPages);
                    if (blob) {
                        console.log(`[AIAnalyze] Drawing Blob size: ${blob.size}`);
                        newFilesToAdd.push(new File([blob], `図面${suffix}.pdf`, { type: 'application/pdf' }));
                    }
                }

                if (newFilesToAdd.length > 0) {
                    setFiles(prev => {
                        // 元のファイルを削除し、新しいファイルを追加
                        const filtered = prev.filter(f => f.name !== file.name);
                        return [...filtered, ...newFilesToAdd];
                    });
                    await showAlert('PDFが「注文書」と「図面」に分割されました。', 'success');
                }
            }
        } catch (error) {
            console.error('AI Analysis error:', error);
            setFileStatuses(prev => ({ ...prev, [file.name]: 'error' }));
            const msg = error.response?.data?.error || 'AI解析に失敗しました。';
            await showAlert(msg, 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleOpenPdfEditor = (index) => {
        setPdfEditorState({
            isOpen: true,
            fileIndex: index,
            file: files[index]
        });
    };

    const handleSaveEditedPdf = (editedFile) => {
        setFiles(prev => {
            const newFiles = [...prev];
            newFiles[pdfEditorState.fileIndex] = editedFile;
            return newFiles;
        });
        // 編集後はステータスをリセットする
        setFileStatuses(prev => {
            const newStatuses = { ...prev };
            delete newStatuses[editedFile.name];
            return newStatuses;
        });
    };

    const handleOpenSearchModal = (index, isExisting = false) => {
        const file = isExisting ? existingFiles[index] : files[index];
        setSearchModalState({
            isOpen: true,
            fileIndex: index,
            file: file,
            isExisting
        });
    };

    const handleApplyMaterialCalc = ({ cost, metadata }) => {
        const targetId = calcModalState.targetItemId;
        setItems(prev => prev.map(item => 
            item.id === targetId ? { ...item, materialCost: cost, material_metadata: metadata } : item
        ));
    };

    const handleCacheSearchResults = (fileIdOrName, results) => {
        setSearchCache(prev => ({
            ...prev,
            [fileIdOrName]: results
        }));
    };

    const handleCacheQueryPreview = (fileIdOrName, blobUrl) => {
        setQueryCache(prev => ({
            ...prev,
            [fileIdOrName]: blobUrl
        }));
    };

    const handleApplySearchResult = async (result) => {
        try {
            // 先に検索モーダルを閉じる（ダイアログが裏に隠れるのを防ぐ）
            setSearchModalState({ isOpen: false, fileIndex: null, file: null });

            const { data: quotation } = await api.get(`/api/quotations/${result.quotation_id}`);
            if (!await showConfirm(`案件「${quotation.order_number || '番号なし'} / ${quotation.company_name}」の単価情報を流用しますか？`)) {
                return;
            }

            setItems(prev => {
                const newItems = [...prev];
                // 1行目が空（品名も金額もない）なら1行目に、そうでなければ先頭に追加
                const targetIdx = (newItems[0] && !newItems[0].name && !newItems[0].processingCost) ? 0 : -1;

                const ref = quotation.quotation_items?.[0] || {};
                const mappedItem = {
                    id: Date.now(),
                    name: ref.name || '',
                    processingCost: ref.processing_cost || '',
                    materialCost: ref.material_cost || '',
                    otherCost: ref.other_cost || '',
                    quantity: 1,
                    responseDate: '',
                    dueDate: '',
                    dimensions: ref.dimensions || '',
                    material_metadata: ref.material_metadata || null,
                    deliveryDate: '',
                    scheduledStartDate: ''
                };

                if (targetIdx !== -1) {
                    newItems[targetIdx] = mappedItem;
                } else {
                    newItems.unshift(mappedItem);
                }
                return newItems;
            });

            setSearchModalState({ isOpen: false, fileIndex: null, file: null });
            await showAlert('見積情報を反映しました。', 'success');
        } catch (err) {
            console.error('Apply error:', err);
            await showAlert('データの取得に失敗しました。', 'error');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Duplicate confirmation
        if (duplicates.orderNumber || duplicates.constructionNumber) {
            const msg = [];
            if (duplicates.orderNumber) msg.push(`注文番号「${headerData.orderNumber}」は既に「${duplicates.orderNumber.companyName}」で登録されています。`);
            if (duplicates.constructionNumber) msg.push(`工事番号「${headerData.constructionNumber}」は既に「${duplicates.constructionNumber.companyName}」で登録されています。`);

            if (!await showConfirm(`${msg.join('\n')}\n\nこのまま保存してもよろしいですか？`)) {
                return;
            }
        }

        setIsSubmitting(true);

        try {
            let quotationId = initialData?.id;

            // 1. Create or Update Quotation Record
            const payload = {
                ...headerData,
                items: items.map((item, idx) => ({ ...item, sortOrder: idx })),
                copyFileIds: pendingCopyFiles.map(f => f.sourceFileId || f.id)
            };

            if (quotationId) {
                // UPDATE
                await api.put(`/api/quotations/${quotationId}`, payload);
            } else {
                // CREATE
                const { data } = await api.post('/api/quotations', payload);
                quotationId = data.id;
            }

            if (files.length > 0) {
                console.log(`[Submit] Uploading ${files.length} files...`);
                const formData = new FormData();
                formData.append('quotationId', quotationId);
                files.forEach(f => {
                    console.log(`  - File: ${f.name}, size: ${f.size}, type: ${f.type}`);
                    formData.append('files', f);
                });

                await api.post('/api/files/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            // 3. Handle File Deletions (if existing files were removed)
            if (initialData?.files) {
                const removedFiles = initialData.files.filter(oldF => !existingFiles.some(curF => curF.id === oldF.id));
                for (const f of removedFiles) {
                    await api.delete(`/api/files/${f.id}`);
                }
            }

            // Callback to parent
            if (onSubmit) onSubmit();

        } catch (error) {
            console.error('Submit Error:', error);
            const detail = error.response?.data?.details || error.response?.data?.error || error.message;
            await showAlert(`保存に失敗しました。\n詳細: ${detail}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Header Data */}
            <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700 backdrop-blur-md">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-2 h-2 bg-cyan-500 rounded-full" />
                        基本情報
                    </h3>

                    {/* Status Toggle */}
                    <div className="flex bg-slate-900/50 p-1 rounded-xl w-full sm:w-auto border border-slate-800">
                        {[
                            { id: 'pending', label: '検討中', active: 'bg-slate-700 text-white shadow-sm' },
                            { id: 'ordered', label: '受注済', active: 'bg-emerald-600 text-white shadow-sm' },
                            { id: 'lost', label: '失注', active: 'bg-red-600 text-white shadow-sm' },
                        ].map((s) => (
                            <button
                                key={s.id} type="button"
                                onClick={() => handleHeaderChange({ target: { name: 'status', value: s.id } })}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex-1 sm:flex-none",
                                    headerData.status === s.id ? s.active : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-400">会社名</label>
                        <input
                            type="text" name="companyName" value={headerData.companyName} onChange={handleHeaderChange}
                            list="company-suggestions" readOnly={!isAdmin} placeholder="株式会社〇〇"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                        />
                        <datalist id="company-suggestions">
                            {companySuggestions.map((c, i) => <option key={i} value={c.name} />)}
                        </datalist>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-400">担当者名</label>
                        <div className="relative">
                            <User size={16} className="absolute left-3 top-2.5 text-slate-500" />
                            <input
                                type="text" name="contactPerson" value={headerData.contactPerson} onChange={handleHeaderChange}
                                readOnly={!isAdmin} placeholder="ご担当者名"
                                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-400">注文番号</label>
                        <input
                            type="text" name="orderNumber" value={headerData.orderNumber} onChange={handleHeaderChange}
                            readOnly={!isAdmin} placeholder="PO-2026-001"
                            className={cn(
                                "w-full px-3 py-2 bg-slate-900 border rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500",
                                duplicates.orderNumber ? "border-amber-500/50" : "border-slate-700"
                            )}
                        />
                        {duplicates.orderNumber && (
                            <p className="text-xs text-amber-500 flex items-center gap-1 mt-1">
                                <AlertCircle size={10} />
                                重複: {duplicates.orderNumber.companyName}
                            </p>
                        )}
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-400">工事番号</label>
                        <input
                            type="text" name="constructionNumber" value={headerData.constructionNumber} onChange={handleHeaderChange}
                            readOnly={!isAdmin} placeholder="K-12345"
                            className={cn(
                                "w-full px-3 py-2 bg-slate-900 border rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500",
                                duplicates.constructionNumber ? "border-amber-500/50" : "border-slate-700"
                            )}
                        />
                        {duplicates.constructionNumber && (
                            <p className="text-xs text-amber-500 flex items-center gap-1 mt-1">
                                <AlertCircle size={10} />
                                重複: {duplicates.constructionNumber.companyName}
                            </p>
                        )}
                    </div>

                    <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-medium text-slate-400">特記事項 (メモ)</label>
                        <textarea
                            ref={notesRef} name="notes" value={headerData.notes} onChange={handleHeaderChange}
                            readOnly={!isAdmin} rows={2} placeholder="メモを入力..."
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 resize-none"
                        />
                    </div>
                </div>

                {/* Dropzone for files */}
                <div className="mt-6 space-y-2">
                    <label className="text-xs font-medium text-slate-400">添付ファイル (.pdf, .dxf, .step)</label>
                    {isAdmin && (
                        <div {...getRootProps()} className={cn(
                            "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200",
                            isDragActive ? "border-cyan-500 bg-cyan-900/20" : "border-slate-700 bg-slate-900/50 hover:border-cyan-400 hover:bg-slate-800"
                        )}>
                            <input {...getInputProps()} />
                            <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                <UploadCloud size={28} className={isDragActive ? "text-cyan-400" : "text-slate-500"} />
                                <div className="space-y-1">
                                    <p className="text-sm font-bold">クリックまたはドラッグ＆ドロップで追加</p>
                                    <p className="text-xs text-slate-500">対応形式: .pdf, .dxf, .step | 1ファイル最大 10MB / 合計 20MB</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between mt-4 mb-2">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-tight">図面・資料リスト</div>
                    </div>

                    <div className="space-y-2 mt-3">
                        {/* Pending Copy Files */}
                        {pendingCopyFiles.length > 0 && (
                            <div className="space-y-1.5 mb-3 mt-4">
                                <p className="text-xs font-bold text-amber-500 uppercase tracking-tighter pl-1 flex items-center gap-1">
                                    <Sparkles size={10} /> 転用コピー予定の図面・資料（保存時に複製されます）
                                </p>
                                {pendingCopyFiles.map((sf, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-amber-900/10 p-2.5 rounded-lg border border-amber-800/30 text-sm">
                                        <div className="flex items-center gap-2 truncate pr-2">
                                            <FileText size={16} className="text-amber-500 shrink-0" />
                                            <button
                                                type="button"
                                                onClick={(e) => handleFileDownload(e, sf.sourceFileId, sf.originalName)}
                                                className="text-amber-300 hover:text-amber-200 hover:underline truncate transition-colors text-left font-medium"
                                                title="転用元のファイルを別タブで開く/ダウンロード"
                                            >
                                                {sf.originalName}
                                            </button>
                                            <span className="text-[10px] bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded border border-amber-800/50 shrink-0 font-bold uppercase tracking-tighter">コピー予定</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setPendingCopyFiles(prev => prev.filter((_, i) => i !== idx))}
                                            className="text-amber-500 hover:text-red-400 shrink-0 p-1 transition-colors"
                                            title="コピーを解除"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {existingFiles.map((f) => (
                            <div key={f.id} className="flex items-start justify-between bg-slate-900/80 p-3 rounded-lg border border-slate-700 text-sm">
                                <div className="flex items-center gap-2 truncate pt-0.5 pr-2">
                                    <FileText size={16} className="text-slate-500 shrink-0" />
                                    <button
                                        type="button"
                                        onClick={(e) => handleFileDownload(e, f.id, f.originalName)}
                                        className="text-blue-400 hover:text-blue-300 hover:underline truncate transition-colors text-left font-medium"
                                        title="この図面を別タブで開く/ダウンロード"
                                    >
                                        {f.originalName}
                                    </button>
                                    <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded shrink-0 font-bold uppercase tracking-tighter">登録済</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isAdmin && (f.originalName || f.original_name)?.toLowerCase().endsWith('.pdf') && (
                                        <div className="flex flex-col items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenSearchModal(existingFiles.indexOf(f), true)}
                                                className={cn(
                                                    "relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md",
                                                    (!credits || credits.balance <= 0)
                                                        ? "bg-slate-800 text-slate-500 border border-slate-700"
                                                        : "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400 border border-amber-400/30 shadow-orange-900/20"
                                                )}
                                                title="この図面から類似箇所を検索"
                                            >
                                                <Search size={14} />
                                                類似図面検索
                                            </button>
                                            <span className="text-[9px] text-orange-400/80 font-medium whitespace-nowrap">※1AIクレジット消費 (結果不問)</span>
                                        </div>
                                    )}
                                    {isAdmin && (
                                        <button type="button" onClick={() => removeExistingFile(f.id)} className="text-slate-500 hover:text-red-400 shrink-0"><X size={16} /></button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {files.map((f, i) => (
                            <div key={i} className="flex items-start justify-between bg-cyan-900/20 p-3 rounded-lg border border-cyan-800/50 text-sm">
                                <div className="flex items-center gap-2 truncate pt-0.5 pr-2">
                                    <UploadCloud size={16} className="text-cyan-500 shrink-0" />
                                    <button
                                        type="button"
                                        onClick={(e) => handleLocalFilePreview(e, f)}
                                        className="text-cyan-400 hover:text-cyan-300 hover:underline truncate transition-colors text-left font-medium"
                                        title="追加したファイルをプレビュー"
                                    >
                                        {f.name}
                                    </button>
                                    <span className="text-[10px] bg-cyan-600 text-white px-1.5 py-0.5 rounded shrink-0 font-bold uppercase tracking-tighter">新規</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {isAdmin && (
                                        <>
                                            {f.name.toLowerCase().endsWith('.pdf') && (
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="flex items-center gap-2">
                                                        {fileStatuses[f.name] === 'analyzing' && (
                                                            <div className="flex items-center gap-1.5 text-amber-500 text-xs font-bold whitespace-nowrap">
                                                                <RefreshCw size={12} className="animate-spin" />
                                                                解析中...
                                                            </div>
                                                        )}
                                                        {(!fileStatuses[f.name] || fileStatuses[f.name] === 'pending' || fileStatuses[f.name] === 'error') && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAIAnalyze(f)}
                                                                disabled={isAnalyzing || !credits || credits.balance <= 0}
                                                                className={cn(
                                                                    "relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-lg",
                                                                    (!credits || credits.balance <= 0)
                                                                        ? "bg-slate-800 text-slate-500 border border-slate-700"
                                                                        : "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400 border border-amber-400/30 shadow-orange-900/20 animate-pulse-subtle"
                                                                )}
                                                                title={(!credits || credits.balance <= 0) ? "クレジットが不足しています" : "この図面をAIで解析する"}
                                                            >
                                                                <Sparkles size={14} className={cn(isAnalyzing ? "animate-spin" : "")} />
                                                                注文書解析
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenSearchModal(i)}
                                                            className={cn(
                                                                "relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md",
                                                                (!credits || credits.balance <= 0)
                                                                    ? "bg-slate-800 text-slate-500 border border-slate-700"
                                                                    : "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400 border border-amber-400/30 shadow-orange-900/20"
                                                            )}
                                                            title="この図面から類似箇所を検索"
                                                        >
                                                            <Search size={14} />
                                                            類似図面検索
                                                        </button>
                                                    </div>
                                                    <span className="text-[9px] text-orange-400/80 font-medium whitespace-nowrap">※1AIクレジット消費 (結果不問)</span>
                                                </div>
                                            )}
                                            {f.type === 'application/pdf' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenPdfEditor(i)}
                                                    className="text-slate-400 hover:text-white p-2 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700 hover:border-slate-500 shadow-sm"
                                                    title="PDFを編集 (回転・削除・並び替え)"
                                                >
                                                    <FileText size={18} />
                                                </button>
                                            )}
                                            <button type="button" onClick={() => removeNewFile(i)} className="text-slate-500 hover:text-red-400 p-2 hover:bg-red-500/10 rounded-xl transition-colors">
                                                <X size={18} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* クレジット枯渇警告 */}
                    {isAdmin && credits && credits.balance <= 0 && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-orange-400 bg-orange-400/10 p-2 rounded-lg border border-orange-400/20">
                            <AlertCircle size={14} />
                            <span>AI解析クレジットが不足しています。プランをアップグレードするか、追加購入してください。</span>
                        </div>
                    )}
                </div>
                {/* History Section - Only for Admins */}
                {isAdmin && history && history.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-700/50">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Activity size={14} className="text-cyan-500" />
                                変更履歴
                            </h4>
                        </div>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {history.map((h) => (
                                <div key={h.id} className="bg-slate-900/40 rounded-xl p-3 border border-slate-800/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-slate-300 font-bold">
                                                {h.users?.name?.charAt(0) || <User size={10} />}
                                            </div>
                                            <span className="text-xs font-bold text-slate-200">{h.users?.name || 'システム'}</span>
                                            <span className="text-[10px] text-slate-500">{new Date(h.created_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold uppercase tracking-tighter">
                                            {h.change_type === 'created' ? '新規登録' :
                                                h.change_type === 'updated' ? '更新' :
                                                    h.change_type === 'deleted' ? '削除' :
                                                        h.change_type === 'restored' ? '復元' : h.change_type}
                                        </span>
                                    </div>
                                    {h.changes && h.change_type !== 'created' && (
                                        <div className="space-y-1 pl-7">
                                            {Object.entries(h.changes).map(([field, delta], idx) => {
                                                const formatVal = (v) => {
                                                    const labels = { pending: '検討中', ordered: '受注', lost: '失注', delivered: '納品済' };
                                                    return labels[v] || (v === null || v === '' || v === undefined ? '空' : String(v));
                                                };
                                                return (
                                                    <div key={idx} className="text-xs flex flex-wrap items-center gap-x-2">
                                                        <span className="text-slate-500 font-bold">{field}:</span>
                                                        {typeof delta === 'object' && delta !== null && 'from' in delta ? (
                                                            <div className="flex items-center gap-1.5 overflow-hidden">
                                                                <span className="text-slate-500 line-through truncate max-w-[100px]">{formatVal(delta.from)}</span>
                                                                <span className="text-slate-600">→</span>
                                                                <span className="text-cyan-400 font-bold truncate max-w-[120px]">{formatVal(delta.to)}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300">{formatVal(delta)}</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Items */}
            <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700 backdrop-blur-md">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-cyan-400 uppercase flex items-center gap-2">
                        <DollarSign size={16} /> 案件明細
                    </h3>
                </div>

                <div className="space-y-4">
                    {items.map((item, index) => (
                        <div key={item.id} className="bg-slate-900 rounded-xl border border-slate-700 p-4 transition-all hover:border-slate-600 relative group">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-4">
                                {/* Row 1: Item Name, Dimensions, Quantity */}
                                <div className="md:col-span-6 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-500 uppercase">品名</label>
                                        {isAdmin && (
                                            <button
                                                type="button"
                                                onClick={() => setPastItemSearch({ isOpen: true, query: item.name, results: [], targetItemId: item.id, isLoading: false })}
                                                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
                                            >
                                                <Search size={10} /> 過去案件から転用
                                            </button>
                                        )}
                                    </div>
                                    <input type="text" value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)}
                                        readOnly={!isAdmin} placeholder="品名..." className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200 text-sm focus:border-cyan-500 outline-none" />
                                </div>
                                <div className="md:col-span-4 space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">寸法</label>
                                    <input type="text" value={item.dimensions || ''} onChange={e => handleItemChange(item.id, 'dimensions', e.target.value)}
                                        readOnly={!isAdmin} placeholder="100x200..." className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200 text-sm focus:border-cyan-500 outline-none" />
                                    {item.material_metadata && (
                                        <div className="text-[10px] text-cyan-500/80 mt-1 font-mono flex flex-wrap gap-x-2 gap-y-0.5">
                                            {item.material_metadata.dims && Object.entries(item.material_metadata.dims).map(([label, val]) => (
                                                <span key={label}>{label}:{val}</span>
                                            ))}
                                            {item.material_metadata.weight && <span>{item.material_metadata.weight}kg</span>}
                                        </div>
                                    )}
                                </div>
                                <div className="md:col-span-2 space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">個数</label>
                                    <input type="number" min="1" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', e.target.value)}
                                        readOnly={!isAdmin} className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200 text-sm focus:border-cyan-500 outline-none text-right" />
                                </div>

                                {/* Row 2: Costs */}
                                <div className="md:col-span-4 space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">加工費</label>
                                    <input type="number" value={item.processingCost} onChange={e => handleItemChange(item.id, 'processingCost', e.target.value)}
                                        readOnly={!isAdmin} placeholder="0" className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200 text-sm focus:border-cyan-500 outline-none text-right" />
                                </div>
                                <div className="md:col-span-4 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-500 uppercase">材料費</label>
                                        {isAdmin && (
                                            <button
                                                type="button"
                                                onClick={() => setCalcModalState({ isOpen: true, targetItemId: item.id })}
                                                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                                            >
                                                <Calculator size={10} /> 自動計算
                                            </button>
                                        )}
                                    </div>
                                    <input type="number" value={item.materialCost} onChange={e => handleItemChange(item.id, 'materialCost', e.target.value)}
                                        readOnly={!isAdmin} placeholder="0" className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200 text-sm focus:border-cyan-500 outline-none text-right" />
                                </div>
                                <div className="md:col-span-4 space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">その他費用</label>
                                    <input type="number" value={item.otherCost} onChange={e => handleItemChange(item.id, 'otherCost', e.target.value)}
                                        readOnly={!isAdmin} placeholder="0" className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200 text-sm focus:border-cyan-500 outline-none text-right" />
                                </div>

                                {/* Row 3: Dates */}
                                <div className="md:col-span-12 flex flex-wrap md:flex-nowrap gap-4 mt-2">
                                    <div className="flex-1 min-w-[120px] space-y-1 text-slate-400 focus-within:text-cyan-400">
                                        <label className="text-[10px] font-bold text-inherit uppercase flex items-center gap-1"><Calendar size={10} />回答日</label>
                                        <input type="date" value={item.responseDate || ''} onChange={e => handleItemChange(item.id, 'responseDate', e.target.value)}
                                            readOnly={!isAdmin} className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-400 text-[10px] focus:border-cyan-500 focus:text-cyan-400 outline-none transition-colors"
                                            style={{ colorScheme: 'dark' }} />
                                    </div>
                                    <div className="flex-1 min-w-[120px] space-y-1 text-slate-400 focus-within:text-cyan-400">
                                        <label className="text-[10px] font-bold text-inherit uppercase flex items-center gap-1"><Calendar size={10} />着手予定日</label>
                                        <input type="date" value={item.scheduledStartDate || ''} onChange={e => handleItemChange(item.id, 'scheduledStartDate', e.target.value)}
                                            readOnly={!isAdmin} className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-400 text-[10px] focus:border-cyan-500 focus:text-cyan-400 outline-none transition-colors"
                                            style={{ colorScheme: 'dark' }} />
                                    </div>
                                    <div className="flex-1 min-w-[120px] space-y-1 text-slate-400 focus-within:text-cyan-400">
                                        <label className="text-[10px] font-bold text-inherit uppercase flex items-center gap-1"><Calendar size={10} />完了予定日</label>
                                        <input type="date" value={item.scheduledEndDate || ''} onChange={e => handleItemChange(item.id, 'scheduledEndDate', e.target.value)}
                                            readOnly={!isAdmin} className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-400 text-[10px] focus:border-cyan-500 focus:text-cyan-400 outline-none transition-colors"
                                            style={{ colorScheme: 'dark' }} />
                                    </div>
                                    <div className="flex-1 min-w-[120px] space-y-1 text-slate-400 focus-within:text-cyan-400">
                                        <label className="text-[10px] font-bold text-inherit uppercase flex items-center gap-1"><Calendar size={10} />納期</label>
                                        <input type="date" value={item.dueDate || ''} onChange={e => handleItemChange(item.id, 'dueDate', e.target.value)}
                                            readOnly={!isAdmin} className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-400 text-[10px] focus:border-cyan-500 focus:text-cyan-400 outline-none transition-colors"
                                            style={{ colorScheme: 'dark' }} />
                                    </div>
                                    <div className="flex-1 min-w-[120px] space-y-1 text-slate-400 focus-within:text-cyan-400">
                                        <label className="text-[10px] font-bold text-inherit uppercase flex items-center gap-1"><Calendar size={10} />納品日</label>
                                        <input type="date" value={item.deliveryDate || ''} onChange={e => handleItemChange(item.id, 'deliveryDate', e.target.value)}
                                            readOnly={!isAdmin} className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-400 text-[10px] focus:border-cyan-500 focus:text-cyan-400 outline-none transition-colors"
                                            style={{ colorScheme: 'dark' }} />
                                    </div>
                                </div>
                            </div>
                            {isAdmin && items.length > 1 && (
                                <button type="button" onClick={() => removeItem(item.id)} className="absolute -right-3 -top-3 bg-slate-800 text-slate-400 p-1.5 rounded-full border border-slate-700 hover:text-red-400 hover:border-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    ))}
                    {isAdmin && (
                        <button type="button" onClick={addItem} className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-slate-700 rounded-xl text-slate-400 hover:text-cyan-400 hover:border-cyan-800 hover:bg-cyan-900/10 transition-colors text-sm font-bold">
                            <Plus size={16} /> 明細行を追加
                        </button>
                    )}
                </div>
            </div >

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-slate-700">
                <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-6 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 font-bold hover:bg-slate-700 transition-colors disabled:opacity-50 shadow-lg">
                    キャンセル
                </button>
                {(initialData?.id || (items && items.length > 0)) && (
                    <button
                        type="button"
                        onClick={() => onPrintMaterialOrder({
                            ...headerData,
                            displayId: initialData?.displayId || 'NEW',
                            items: items
                        })}
                        className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 font-bold hover:bg-slate-700 transition-colors shadow-lg"
                    >
                        <FileText size={18} className="text-blue-400" />
                        <span>材料注文書 (PDF)</span>
                    </button>
                )}
                {
                    isAdmin && (
                        <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-8 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100">
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Save size={18} />
                            )}
                            <span>{initialData ? '更新を保存\u00A0' : '案件を登録'}</span>
                        </button>
                    )
                }
            </div>

            {/* Past Item Search Modal */}
            {pastItemSearch.isOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
                                <Search size={20} /> 過去案件から転用
                            </h3>
                            <button type="button" onClick={() => setPastItemSearch(prev => ({ ...prev, isOpen: false }))} className="text-slate-500 hover:text-slate-300">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={pastItemSearch.query}
                                onChange={e => setPastItemSearch(prev => ({ ...prev, query: e.target.value }))}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSearchPastItems(pastItemSearch.query);
                                    }
                                }}
                                placeholder="品名で検索 (Enterで実行)"
                                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:border-cyan-500 outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => handleSearchPastItems(pastItemSearch.query)}
                                disabled={pastItemSearch.isLoading || !pastItemSearch.query}
                                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                            >
                                {pastItemSearch.isLoading ? '検索中...' : '検索'}
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-[300px] border border-slate-800 rounded-xl bg-slate-900/50">
                            {pastItemSearch.results.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-slate-500 text-sm py-10">
                                    {pastItemSearch.isLoading ? '検索中...' : '検索結果がここに表示されます'}
                                </div>
                            ) : (
                                <ul className="divide-y divide-slate-800/50">
                                    {pastItemSearch.results.map(r => (
                                        <li key={r.id} className="p-3 hover:bg-slate-800/50 transition-colors flex justify-between items-center group">
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-bold text-slate-200 truncate pr-4">{r.name}</div>
                                                <div className="text-xs text-slate-500 flex gap-3 mt-1 flex-wrap items-center">
                                                    <span className="truncate max-w-[150px]" title={r.quotations?.company_name}>{r.quotations?.company_name}</span>
                                                    <span>加工費: ¥{Number(r.processing_cost || 0).toLocaleString()}</span>
                                                    <span>作成日: {new Date(r.quotations?.created_at).toLocaleDateString()}</span>
                                                    {r.quotations?.id && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSourceQuotationView(r.quotations);
                                                            }}
                                                            className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-0.5"
                                                            title="元案件の詳細を見る"
                                                        >
                                                            <LinkIcon size={10} /> 転用元案件
                                                        </button>
                                                    )}
                                                </div>
                                                {r.quotations?.quotation_files && r.quotations.quotation_files.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {r.quotations.quotation_files.map(f => (
                                                            <button
                                                                key={f.id}
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleFileDownload(e, f.id, f.originalName || f.original_name);
                                                                }}
                                                                className="flex items-center gap-1.5 text-[11px] bg-slate-800/80 text-blue-400 px-2 py-1 rounded border border-slate-700 hover:bg-slate-700 hover:border-blue-500/50 hover:text-blue-300 transition-colors font-medium"
                                                                title="この図面を別タブで開く/ダウンロード"
                                                            >
                                                                <FileText size={12} className="shrink-0" />
                                                                <span className="truncate max-w-[120px]">{f.original_name}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleApplyPastItem(r)}
                                                className="px-3 py-1.5 shrink-0 bg-slate-800 hover:bg-cyan-600 border border-slate-700 hover:border-cyan-500 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition-all xl:opacity-0 xl:group-hover:opacity-100"
                                            >
                                                転用
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {/* Source Quotation Detail Modal */}
            {sourceQuotationView && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative">
                        <button
                            onClick={() => setSourceQuotationView(null)}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 rounded-full transition-colors z-10"
                        >
                            <X size={20} />
                        </button>
                        <div className="p-6 border-b border-slate-800">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Search className="text-blue-400" size={24} />
                                転用元案件の詳細
                            </h3>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4">
                            <div className="space-y-1">
                                <p className="text-xs text-slate-500 font-bold uppercase">会社名</p>
                                <p className="text-slate-200 text-lg font-bold">{sourceQuotationView.company_name || '（会社名なし）'}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-500 font-bold uppercase">注文番号</p>
                                    <p className="text-slate-300">{sourceQuotationView.order_number || '-'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-500 font-bold uppercase">作成日</p>
                                    <p className="text-slate-300">{new Date(sourceQuotationView.created_at).toLocaleDateString()}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-500 font-bold uppercase">ステータス</p>
                                    <p className="text-slate-300">
                                        {sourceQuotationView.status === 'delivered' ? '納品済' :
                                            sourceQuotationView.status === 'ordered' ? '受注' :
                                                sourceQuotationView.status === 'lost' ? '失注' : '検討中'}
                                    </p>
                                </div>
                            </div>
                            {sourceQuotationView.quotation_files && sourceQuotationView.quotation_files.length > 0 && (
                                <div className="space-y-2 mt-4">
                                    <p className="text-xs text-slate-500 font-bold uppercase">添付ファイル（図面など）</p>
                                    <div className="flex flex-col gap-2">
                                        {sourceQuotationView.quotation_files.map(f => (
                                            <div key={f.id} className="flex items-center justify-between bg-slate-800/50 p-2.5 rounded-lg border border-slate-700">
                                                <div className="flex items-center gap-2 truncate">
                                                    <FileText size={16} className="text-slate-400 shrink-0" />
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleFileDownload(e, f.id, f.original_name)}
                                                        className="text-blue-400 hover:text-blue-300 hover:underline truncate transition-colors text-left font-medium"
                                                        title="この図面を別タブで開く/ダウンロード"
                                                    >
                                                        {f.original_name}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* PDF Editor Modal */}
            <PdfEditorModal
                isOpen={pdfEditorState.isOpen}
                file={pdfEditorState.file}
                onClose={() => setPdfEditorState({ isOpen: false, fileIndex: null, file: null })}
                onSave={handleSaveEditedPdf}
            />

            {searchModalState.isOpen && (
                <DrawingSearchModal
                    isOpen={searchModalState.isOpen}
                    onClose={() => setSearchModalState({ isOpen: false, fileIndex: null, file: null, isExisting: false })}
                    file={searchModalState.file}
                    pdfFile={!searchModalState.isExisting && searchModalState.file instanceof File ? searchModalState.file : null}
                    fileId={searchModalState.isExisting ? searchModalState.file?.id : null}
                    onApplyResult={handleApplySearchResult}
                    initialResults={searchCache[searchModalState.file?.id || searchModalState.file?.name]}
                    onSaveResults={(results) => handleCacheSearchResults(searchModalState.file?.id || searchModalState.file?.name, results)}
                    initialQueryPreview={queryCache[searchModalState.file?.id || searchModalState.file?.name]}
                    onSaveQueryPreview={(blobUrl) => handleCacheQueryPreview(searchModalState.file?.id || searchModalState.file?.name, blobUrl)}
                />
            )}

            <MaterialCostCalcModal
                isOpen={calcModalState.isOpen}
                onClose={() => setCalcModalState({ isOpen: false, targetItemId: null })}
                onApply={handleApplyMaterialCalc}
                initialMetadata={items.find(item => item.id === calcModalState.targetItemId)?.material_metadata}
            />
        </form >
    );
}
