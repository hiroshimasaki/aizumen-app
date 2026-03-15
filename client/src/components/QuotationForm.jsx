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
import Accordion from './common/Accordion';

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

    const [files, setFiles] = useState([]); 
    const [existingFiles, setExistingFiles] = useState([]); 
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [fileStatuses, setFileStatuses] = useState({}); 
    const [companySuggestions, setCompanySuggestions] = useState([]);
    const [duplicates, setDuplicates] = useState({ orderNumber: null, constructionNumber: null });
    const [pastItemSearch, setPastItemSearch] = useState({ isOpen: false, query: '', results: [], targetItemId: null, isLoading: false });
    const [pendingCopyFiles, setPendingCopyFiles] = useState([]);
    const [sourceQuotationView, setSourceQuotationView] = useState(null);
    const [pdfEditorState, setPdfEditorState] = useState({ isOpen: false, fileIndex: null, file: null });
    const [searchModalState, setSearchModalState] = useState({ isOpen: false, fileIndex: null, file: null, isExisting: false });
    const [searchCache, setSearchCache] = useState({}); 
    const [queryCache, setQueryCache] = useState({});   
    const [history, setHistory] = useState([]);
    const [calcModalState, setCalcModalState] = useState({ isOpen: false, targetItemId: null });
    const [aiAnalysisResults, setAiAnalysisResults] = useState(null);
    const notesRef = useRef(null);

    useEffect(() => {
        if (notesRef.current) {
            notesRef.current.style.height = 'auto';
            notesRef.current.style.height = `${notesRef.current.scrollHeight}px`;
        }
    }, [headerData.notes]);

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
            if (initialData.files) setExistingFiles(initialData.files);
            if (initialData.sourceFiles) setPendingCopyFiles(initialData.sourceFiles);
            if (initialData.quotation_history) setHistory(initialData.quotation_history);
        }
    }, [initialData]);

    useEffect(() => {
        if (quotationId) {
            api.get(`/api/quotations/${quotationId}`)
                .then(res => {
                    if (res.data.quotation_history) setHistory(res.data.quotation_history);
                })
                .catch(err => console.error('Failed to fetch history:', err));
        }
    }, [quotationId]);

    const onDrop = useCallback((acceptedFiles, fileRejections) => {
        setFiles(prev => [...prev, ...acceptedFiles]);
        if (fileRejections.length > 0) {
            const errors = fileRejections.map(rejection => {
                const name = rejection.file.name;
                const error = rejection.errors[0]?.code === 'file-invalid-type' ? '未対応の形式です' : rejection.errors[0]?.message;
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
            setPastItemSearch(prev => ({ ...prev, isLoading: false }));
        }
    };

    const handleApplyPastItem = (pastItem) => {
        const targetId = pastItemSearch.targetItemId;
        if (!targetId) return;
        setItems(prev => prev.map(item => item.id === targetId ? {
            ...item,
            name: pastItem.name,
            processingCost: pastItem.processing_cost || '',
            materialCost: pastItem.material_cost || '',
            otherCost: pastItem.other_cost || '',
            dimensions: pastItem.dimensions || ''
        } : item));
        if (pastItem.quotations?.quotation_files) {
            setPendingCopyFiles(prev => {
                const newFiles = [...prev];
                pastItem.quotations.quotation_files.forEach(f => {
                    if (!newFiles.some(existing => existing.sourceFileId === f.id)) {
                        newFiles.push({ sourceFileId: f.id, originalName: f.original_name });
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
                timeout: 180000 
            });
            if (setCredits && data.creditStats) {
                setCredits(prev => ({
                    ...prev,
                    balance: data.creditStats.remainingBalance,
                    purchased_balance: data.creditStats.purchasedBalance !== undefined ? data.creditStats.purchasedBalance : prev.purchased_balance
                }));
            }
            // AI解析の生結果を保存 (学習用)
            setAiAnalysisResults(data);

            setHeaderData(prev => ({
                ...prev,
                companyName: data.companyName || prev.companyName,
                orderNumber: data.orderNumber || prev.orderNumber,
                constructionNumber: data.constructionNumber || prev.constructionNumber,
                notes: data.notes ? (prev.notes ? `${prev.notes}\n${data.notes}` : data.notes) : prev.notes
            }));
            if (data.items) {
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
                            requiresVerification: aiItem.requiresVerification || false,
                            deliveryDate: '',
                            scheduledStartDate: ''
                        };
                        const emptyIdx = newItems.findIndex(item => !item.name && !item.processingCost);
                        if (emptyIdx !== -1) newItems[emptyIdx] = mappedItem;
                        else newItems.push(mappedItem);
                    });
                    return newItems;
                });
            }
            setFileStatuses(prev => ({ ...prev, [file.name]: 'completed' }));
            if (data.pageClassifications) {
                const orderFormPages = data.pageClassifications.filter(p => p.type === 'order_form').map(p => p.page);
                const drawingPages = data.pageClassifications.filter(p => p.type === 'drawing').map(p => p.page);
                const suffix = data.orderNumber ? `_${data.orderNumber}` : '';
                const newFilesToAdd = [];
                if (orderFormPages.length > 0) {
                    const blob = await splitPdf(file, orderFormPages);
                    if (blob) newFilesToAdd.push(new File([blob], `注文書${suffix}.pdf`, { type: 'application/pdf' }));
                }
                if (drawingPages.length > 0) {
                    const blob = await splitPdf(file, drawingPages);
                    if (blob) newFilesToAdd.push(new File([blob], `図面${suffix}.pdf`, { type: 'application/pdf' }));
                }
                if (newFilesToAdd.length > 0) {
                    setFiles(prev => [...prev.filter(f => f.name !== file.name), ...newFilesToAdd]);
                    await showAlert('PDFが「注文書」と「図面」に分割されました。', 'success');
                }
            }
        } catch (error) {
            console.error('AI Analysis error:', error);
            setFileStatuses(prev => ({ ...prev, [file.name]: 'error' }));
            await showAlert(error.response?.data?.error || 'AI解析に失敗しました。', 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleOpenPdfEditor = (index) => setPdfEditorState({ isOpen: true, fileIndex: index, file: files[index] });
    const handleSaveEditedPdf = (editedFile) => {
        setFiles(prev => {
            const newFiles = [...prev];
            newFiles[pdfEditorState.fileIndex] = editedFile;
            return newFiles;
        });
        setFileStatuses(prev => {
            const newStatuses = { ...prev };
            delete newStatuses[editedFile.name];
            return newStatuses;
        });
    };

    const handleOpenSearchModal = (index, isExisting = false) => {
        const file = isExisting ? existingFiles[index] : files[index];
        setSearchModalState({ isOpen: true, fileIndex: index, file: file, isExisting });
    };

    const handleApplyMaterialCalc = ({ cost, metadata }) => {
        const targetId = calcModalState.targetItemId;
        setItems(prev => prev.map(item => item.id === targetId ? { ...item, materialCost: cost, material_metadata: metadata } : item));
    };

    const handleCacheSearchResults = (id, res) => setSearchCache(prev => ({ ...prev, [id]: res }));
    const handleCacheQueryPreview = (id, url) => setQueryCache(prev => ({ ...prev, [id]: url }));

    const handleApplySearchResult = async (result) => {
        try {
            setSearchModalState({ isOpen: false, fileIndex: null, file: null });
            const { data: q } = await api.get(`/api/quotations/${result.quotation_id}`);
            if (!await showConfirm(`案件「${q.order_number || '番号なし'} / ${q.company_name}」の単価情報を流用しますか？`)) return;
            setItems(prev => {
                const newItems = [...prev];
                const targetIdx = (newItems[0] && !newItems[0].name && !newItems[0].processingCost) ? 0 : -1;
                const ref = q.quotation_items?.[0] || {};
                const mapped = {
                    id: Date.now(), name: ref.name || '', processingCost: ref.processing_cost || '',
                    materialCost: ref.material_cost || '', otherCost: ref.other_cost || '', quantity: 1,
                    responseDate: '', dueDate: '', dimensions: ref.dimensions || '', material_metadata: ref.material_metadata || null,
                    deliveryDate: '', scheduledStartDate: ''
                };
                if (targetIdx !== -1) newItems[targetIdx] = mapped;
                else newItems.unshift(mapped);
                return newItems;
            });
            await showAlert('見積情報を反映しました。', 'success');
        } catch (err) {
            console.error('Apply error:', err);
            await showAlert('データの取得に失敗しました。', 'error');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (duplicates.orderNumber || duplicates.constructionNumber) {
            const msg = [];
            if (duplicates.orderNumber) msg.push(`注文番号「${headerData.orderNumber}」は既に「${duplicates.orderNumber.companyName}」で登録されています。`);
            if (duplicates.constructionNumber) msg.push(`工事番号「${headerData.constructionNumber}」は既に「${duplicates.constructionNumber.companyName}」で登録されています。`);
            if (!await showConfirm(`${msg.join('\n')}\n\nこのまま保存してもよろしいですか？`)) return;
        }
        setIsSubmitting(true);
        try {
            let qId = initialData?.id;
            const payload = { 
                ...headerData, 
                items: items.map((t, i) => ({ ...t, sortOrder: i })), 
                copyFileIds: pendingCopyFiles.map(f => f.sourceFileId || f.id),
                aiOriginalResult: aiAnalysisResults // 学習用に解析時のデータを送る
            };
            if (qId) await api.put(`/api/quotations/${qId}`, payload);
            else {
                const { data } = await api.post('/api/quotations', payload);
                qId = data.id;
            }
            if (files.length > 0) {
                const fd = new FormData();
                fd.append('quotationId', qId);
                files.forEach(f => fd.append('files', f));
                await api.post('/api/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            }
            if (initialData?.files) {
                const removed = initialData.files.filter(o => !existingFiles.some(c => c.id === o.id));
                for (const f of removed) await api.delete(`/api/files/${f.id}`);
            }
            if (onSubmit) onSubmit();
        } catch (error) {
            console.error('Submit Error:', error);
            await showAlert(`保存に失敗しました。\n詳細: ${error.response?.data?.details || error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Accordion title="基本情報" icon={<User size={18} className="text-cyan-400" />} defaultOpen={true}>
                <div className="p-6 space-y-6">
                    <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded-2xl border border-slate-700/50 w-fit">
                        {[
                            { id: 'pending', label: '検討中', active: 'bg-slate-700 text-white shadow-md' },
                            { id: 'ordered', label: '受注', active: 'bg-emerald-600 text-white' },
                            { id: 'lost', label: '失注', active: 'bg-red-600 text-white' },
                        ].map((s) => (
                            <button
                                key={s.id} type="button"
                                onClick={() => handleHeaderChange({ target: { name: 'status', value: s.id } })}
                                className={cn("px-4 py-1.5 rounded-xl text-xs font-bold transition-all", headerData.status === s.id ? s.active : "text-slate-500 hover:text-slate-300")}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5 text-left">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">会社名</label>
                            <input
                                type="text" name="companyName" value={headerData.companyName} onChange={handleHeaderChange}
                                list="company-suggestions" readOnly={!isAdmin} placeholder="株式会社〇〇"
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-2xl text-slate-100 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder:text-slate-600"
                            />
                            <datalist id="company-suggestions">
                                {companySuggestions.map((c, i) => <option key={i} value={c.name} />)}
                            </datalist>
                        </div>
                        <div className="space-y-1.5 text-left">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">担当者名</label>
                            <input
                                type="text" name="contactPerson" value={headerData.contactPerson} onChange={handleHeaderChange}
                                placeholder="ご担当者名"
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-2xl text-slate-100 focus:outline-none focus:border-cyan-500 transition-all placeholder:text-slate-600"
                            />
                        </div>
                        <div className="space-y-1.5 text-left">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">注文番号</label>
                            <input
                                type="text" name="orderNumber" value={headerData.orderNumber} onChange={handleHeaderChange}
                                className={cn("w-full px-4 py-3 bg-slate-900 border rounded-2xl text-slate-100 placeholder:text-slate-600", duplicates.orderNumber ? "border-amber-500" : "border-slate-700/50")}
                                placeholder="PO-12345"
                            />
                        </div>
                        <div className="space-y-1.5 text-left">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">工事番号</label>
                            <input
                                type="text" name="constructionNumber" value={headerData.constructionNumber} onChange={handleHeaderChange}
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-2xl text-slate-100 placeholder:text-slate-600"
                                placeholder="K-12345"
                            />
                        </div>
                        <div className="md:col-span-2 space-y-1.5 text-left">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">特記事項 (メモ)</label>
                            <textarea
                                ref={notesRef} name="notes" value={headerData.notes} onChange={handleHeaderChange}
                                placeholder="案件に関する補足情報を入力..."
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-2xl text-slate-100 min-h-[80px] focus:outline-none focus:border-cyan-500 transition-all resize-none"
                            />
                        </div>
                    </div>
                </div>
            </Accordion>

            <Accordion title="図面・資料" icon={<FileText size={18} className="text-blue-400" />}>
                <div className="p-6 space-y-6">
                    {isAdmin && (
                        <div {...getRootProps()} className={cn(
                            "border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all",
                            isDragActive ? "border-cyan-500 bg-cyan-500/5" : "border-slate-800 bg-slate-900/30 hover:border-slate-700 hover:bg-slate-900/50"
                        )}>
                            <input {...getInputProps()} />
                            <p className="text-sm font-bold text-slate-400">図面や注文書のファイルをドロップ</p>
                            <p className="text-[10px] text-slate-500 mt-1.5 font-bold">
                                対応形式: .pdf, .dxf, .step | 1ファイル最大 10MB / 合計 20MB
                            </p>
                            <p className="text-[9px] text-slate-600 mt-1 uppercase tracking-widest font-black">AI OCR / Split PDF support</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {pendingCopyFiles.map((f, i) => (
                            <div key={`copy-${i}`} className="flex items-center justify-between p-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                                <div className="flex items-center gap-3 truncate">
                                    <Sparkles size={16} className="text-amber-500 shrink-0" />
                                    <span className="text-xs font-bold text-slate-300 truncate">{f.originalName}</span>
                                    <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-black uppercase">Copy</span>
                                </div>
                                <button type="button" onClick={() => setPendingCopyFiles(p => p.filter((_, idx) => idx !== i))} className="text-slate-600 hover:text-red-400"><X size={16} /></button>
                            </div>
                        ))}
                        {existingFiles.map((f, i) => (
                            <div key={f.id} className="flex flex-col p-4 bg-slate-900/50 border border-slate-800 rounded-3xl gap-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 truncate">
                                        <FileText size={18} className="text-blue-400 shrink-0" />
                                        <button type="button" onClick={(e) => handleFileDownload(e, f.id, f.originalName || f.original_name)} className="text-xs font-bold text-slate-200 hover:text-blue-400 truncate underline decoration-slate-700">{f.originalName || f.original_name}</button>
                                    </div>
                                    <button type="button" onClick={() => removeExistingFile(f.id)} className="text-slate-600 hover:text-red-400"><X size={18} /></button>
                                </div>
                            </div>
                        ))}
                        {files.map((f, i) => (
                            <div key={`new-${i}`} className="flex flex-col p-4 bg-cyan-950/20 border border-cyan-500/30 rounded-3xl gap-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 truncate">
                                        <UploadCloud size={18} className="text-cyan-400 shrink-0" />
                                        <button type="button" onClick={(e) => handleLocalFilePreview(e, f)} className="text-xs font-bold text-cyan-100 truncate underline decoration-cyan-900">{f.name}</button>
                                    </div>
                                    <button type="button" onClick={() => removeNewFile(i)} className="text-slate-600 hover:text-red-400"><X size={18} /></button>
                                </div>
                                <div className="flex gap-2">
                                    {f.name.toLowerCase().endsWith('.pdf') && (
                                        <>
                                            <button
                                                type="button" onClick={() => handleAIAnalyze(f)} disabled={isAnalyzing}
                                                className="flex-1 py-2 bg-gradient-to-br from-amber-500 to-orange-600 text-white text-[10px] font-black rounded-xl shadow-lg shadow-orange-950/20 flex items-center justify-center gap-2"
                                            >
                                                {fileStatuses[f.name] === 'analyzing' ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                                注文書解析
                                            </button>
                                            <button
                                                type="button" onClick={() => handleOpenSearchModal(i)}
                                                className="px-3 bg-slate-800 rounded-xl text-cyan-400 border border-white/5 hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 text-[10px] font-black"
                                                title="類似図面検索"
                                            >
                                                <Search size={14} /> 検索
                                            </button>
                                            <button
                                                type="button" onClick={() => handleOpenPdfEditor(i)}
                                                className="p-2 bg-slate-800 rounded-xl text-slate-300 border border-white/5 hover:bg-slate-700 transition-colors"
                                                title="分割・編集"
                                            ><Activity size={16} /></button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Accordion>

            <Accordion title="案件明細" icon={<Plus size={18} className="text-emerald-400" />}>
                <div className="p-6 space-y-4">
                    <div className="flex justify-end mb-2">
                        <button type="button" onClick={addItem} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-white/5 transition-all">
                            <Plus size={14} className="text-emerald-400" /> 明細を追加
                        </button>
                    </div>

                    <div className="space-y-4">
                        {items.map((item, idx) => (
                            <div key={item.id} className={cn(
                                "group border rounded-3xl p-5 hover:border-slate-700 transition-all relative overflow-hidden",
                                item.requiresVerification ? "bg-amber-950/20 border-amber-500/30" : "bg-slate-950/40 border-slate-800"
                            )}>
                                {item.requiresVerification && (
                                    <div className="absolute top-2 right-12 flex items-center gap-1 text-amber-500 animate-pulse bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                        <AlertCircle size={10} />
                                        <span className="text-[9px] font-black uppercase tracking-tighter">Check Required</span>
                                    </div>
                                )}
                                <div className={cn(
                                    "absolute top-0 left-0 w-1 h-full transition-all",
                                    item.requiresVerification ? "bg-amber-500" : "bg-slate-800 group-hover:bg-cyan-600"
                                )} />
                                <div className="flex flex-col gap-5">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="md:col-span-2 space-y-1">
                                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">品名 / 型式</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text" value={item.name} onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                                                        className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm focus:border-cyan-500 transition-all"
                                                        placeholder="部品名・型式を入力"
                                                    />
                                                    <button
                                                        type="button" onClick={() => setPastItemSearch({ isOpen: true, query: item.name, results: [], targetItemId: item.id, isLoading: false })}
                                                        className="p-2.5 bg-slate-800 text-cyan-400 rounded-xl hover:bg-cyan-500 hover:text-white transition-all border border-white/5 shadow-lg"
                                                        title="過去案件から転用"
                                                    ><Search size={18} /></button>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">寸法 / 備考</label>
                                                <input
                                                    type="text" value={item.dimensions} onChange={(e) => handleItemChange(item.id, 'dimensions', e.target.value)}
                                                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm focus:border-cyan-500 transition-all"
                                                    placeholder="L=100 W=50 等"
                                                />
                                            </div>
                                        </div>
                                        {items.length > 1 && (
                                            <button type="button" onClick={() => removeItem(item.id)} className="p-2.5 text-slate-600 hover:text-red-400 transition-colors ml-4"><Trash2 size={20} /></button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-600 uppercase">基本加工費</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-slate-500 text-xs">¥</span>
                                                <input
                                                    type="text" value={item.processingCost} onChange={(e) => handleItemChange(item.id, 'processingCost', e.target.value)}
                                                    className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-cyan-400 font-bold focus:border-cyan-500"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-600 uppercase">材料費</label>
                                            <div className="relative flex gap-1">
                                                <div className="relative flex-1">
                                                    <span className="absolute left-3 top-2.5 text-slate-500 text-xs">¥</span>
                                                    <input
                                                        type="text" value={item.materialCost} onChange={(e) => handleItemChange(item.id, 'materialCost', e.target.value)}
                                                        className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm focus:border-cyan-500"
                                                    />
                                                </div>
                                                <button
                                                    type="button" onClick={() => setCalcModalState({ isOpen: true, targetItemId: item.id })}
                                                    className="p-2 bg-slate-800 text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-white transition-all border border-white/5"
                                                    title="材料費計算"
                                                ><Calculator size={16} /></button>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-600 uppercase">その他費用</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-slate-500 text-xs">¥</span>
                                                <input
                                                    type="text" value={item.otherCost} onChange={(e) => handleItemChange(item.id, 'otherCost', e.target.value)}
                                                    className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm focus:border-cyan-500"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-600 uppercase">数量</label>
                                            <input
                                                type="number" value={item.quantity} onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm focus:border-cyan-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-2 border-t border-slate-800/50">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase">回答日</label>
                                            <input
                                                type="date" value={item.responseDate || ''} onChange={(e) => handleItemChange(item.id, 'responseDate', e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-300 focus:border-cyan-500"
                                                style={{ colorScheme: 'dark' }}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase">着手予定日</label>
                                            <input
                                                type="date" value={item.scheduledStartDate || ''} onChange={(e) => handleItemChange(item.id, 'scheduledStartDate', e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-300 focus:border-cyan-500"
                                                style={{ colorScheme: 'dark' }}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase">完了予定日</label>
                                            <input
                                                type="date" value={item.scheduledEndDate || ''} onChange={(e) => handleItemChange(item.id, 'scheduledEndDate', e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-300 focus:border-cyan-500"
                                                style={{ colorScheme: 'dark' }}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase">納期</label>
                                            <input
                                                type="date" value={item.dueDate || ''} onChange={(e) => handleItemChange(item.id, 'dueDate', e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-orange-400 focus:border-cyan-500"
                                                style={{ colorScheme: 'dark' }}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase">納品日</label>
                                            <input
                                                type="date" value={item.deliveryDate || ''} onChange={(e) => handleItemChange(item.id, 'deliveryDate', e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-emerald-400 focus:border-cyan-500"
                                                style={{ colorScheme: 'dark' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Accordion>

            {isAdmin && history && history.length > 0 && (
                <Accordion title="変更履歴" icon={<Activity size={18} className="text-slate-500" />}>
                    <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {history.map((h) => (
                            <div key={h.id} className="bg-slate-900/40 rounded-2xl p-4 border border-slate-800/50 flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-200">{h.users?.name || 'システム'}</span>
                                        <span className="text-[10px] text-slate-500">{new Date(h.created_at).toLocaleString()}</span>
                                    </div>
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold uppercase">{h.change_type}</span>
                                </div>
                                {h.changes && Object.entries(h.changes).map(([f, d], i) => {
                                    const formatValue = (v) => {
                                        if (v === null || v === undefined || v === '') return 'なし';
                                        return String(v);
                                    };
                                    return (
                                        <div key={i} className="text-[11px] text-slate-400 flex gap-2 pl-2">
                                            <span className="font-bold">{f}:</span>
                                            <span>{formatValue(d.from)} → <span className="text-cyan-400">{formatValue(d.to)}</span></span>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </Accordion>
            )}

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-800">
                <button type="button" onClick={onCancel} className="px-6 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 font-bold hover:bg-slate-800 transition-all">キャンセル</button>
                {(initialData?.id || items.length > 0) && (
                    <button
                        type="button" onClick={() => onPrintMaterialOrder({ ...headerData, displayId: initialData?.displayId || 'NEW', items: items })}
                        className="px-6 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-white font-bold hover:bg-slate-800 flex items-center gap-2 transition-all shadow-xl shadow-blue-950/20"
                    ><FileText size={18} />材料注文書 (PDF)</button>
                )}
                {isAdmin && (
                    <button type="submit" disabled={isSubmitting} className="group relative px-10 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 transition-all">
                        <div className="flex items-center gap-2">
                            {isSubmitting ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                            <span>{initialData ? '更新を保存' : '案件を登録'}</span>
                        </div>
                    </button>
                )}
            </div>

            {pastItemSearch.isOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-white flex items-center gap-3"><Search className="text-cyan-400" /> 過去案件からの転用</h3>
                            <button type="button" onClick={() => setPastItemSearch(p => ({ ...p, isOpen: false }))} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 transition-colors"><X size={20} /></button>
                        </div>
                        <div className="flex gap-2 mb-6">
                            <input
                                type="text" value={pastItemSearch.query} onChange={e => setPastItemSearch(p => ({ ...p, query: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSearchPastItems(pastItemSearch.query))}
                                placeholder="品名や型式で検索..."
                                className="flex-1 px-4 py-3 bg-slate-950 border border-slate-700 rounded-2xl text-slate-100"
                            />
                            <button type="button" onClick={() => handleSearchPastItems(pastItemSearch.query)} className="px-6 bg-cyan-600 text-white rounded-2xl font-bold">検索</button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                            {pastItemSearch.results.map(r => (
                                <div key={r.id} className="p-4 bg-slate-950/50 border border-slate-800 rounded-2xl hover:border-cyan-500/50 transition-all flex justify-between items-center">
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-slate-200">{r.name}</p>
                                        <p className="text-[10px] text-slate-500">{r.quotations?.company_name} | {new Date(r.quotations?.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <button onClick={() => handleApplyPastItem(r)} className="px-4 py-1.5 bg-slate-800 text-cyan-400 text-xs font-black rounded-xl border border-white/5 hover:bg-cyan-600 hover:text-white transition-all">転用</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>, document.body
            )}

            {sourceQuotationView && createPortal(
                <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                            <h3 className="font-black text-white flex items-center gap-3"><Search className="text-blue-400" /> 転用元案件の詳細</h3>
                            <button onClick={() => setSourceQuotationView(null)} className="p-2 text-slate-500 hover:text-white"><X size={24} /></button>
                        </div>
                        <div className="p-6 space-y-6 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2"><p className="text-[10px] text-slate-500 font-bold uppercase">会社名</p><p className="text-lg font-black text-white">{sourceQuotationView.company_name}</p></div>
                                <div><p className="text-[10px] text-slate-500 font-bold uppercase">注文番号</p><p className="text-sm text-slate-300 font-bold">{sourceQuotationView.order_number || '-'}</p></div>
                                <div><p className="text-[10px] text-slate-500 font-bold uppercase">作成日</p><p className="text-sm text-slate-300 font-bold">{new Date(sourceQuotationView.created_at).toLocaleDateString()}</p></div>
                            </div>
                            {sourceQuotationView.quotation_files?.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">添付図面</p>
                                    <div className="flex flex-col gap-2">
                                        {sourceQuotationView.quotation_files.map(f => (
                                            <div key={f.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-2xl border border-white/5">
                                                <FileText size={16} className="text-blue-400" />
                                                <button onClick={(e) => handleFileDownload(e, f.id, f.original_name)} className="text-xs font-bold text-slate-300 hover:text-white truncate underline">{f.original_name}</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>, document.body
            )}

            <PdfEditorModal
                isOpen={pdfEditorState.isOpen} file={pdfEditorState.file}
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
                    onSaveResults={(res) => handleCacheSearchResults(searchModalState.file?.id || searchModalState.file?.name, res)}
                    initialQueryPreview={queryCache[searchModalState.file?.id || searchModalState.file?.name]}
                    onSaveQueryPreview={(url) => handleCacheQueryPreview(searchModalState.file?.id || searchModalState.file?.name, url)}
                />
            )}

            <MaterialCostCalcModal
                isOpen={calcModalState.isOpen} onClose={() => setCalcModalState({ isOpen: false, targetItemId: null })}
                onApply={handleApplyMaterialCalc}
                initialMetadata={items.find(t => t.id === calcModalState.targetItemId)?.material_metadata}
            />
        </form>
    );
}
