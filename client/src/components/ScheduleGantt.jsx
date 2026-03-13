import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar, AlertTriangle, Check, ExternalLink, PackageCheck, GripVertical } from 'lucide-react';
import api from '../lib/api';
import { useNotification } from '../contexts/NotificationContext';

export default function ScheduleGantt({ quotations, onEdit, onRefresh, isAdmin = true }) {
    const { showAlert, showConfirm } = useNotification();
    const [dayOffset, setDayOffset] = useState(0);
    const [selectedItems, setSelectedItems] = useState([]); // Array of item IDs
    const [deliveryProcessing, setDeliveryProcessing] = useState(false);
    const [dragState, setDragState] = useState(null); // { itemId, type: 'start'|'end', originalDate, startX }
    const [dragDaysDiff, setDragDaysDiff] = useState(0);
    const containerRef = useRef(null);
    const clickBlockRef = useRef(false);
    const VISIBLE_DAYS = 30;

    const toYMD = (date) => {
        if (!date) return null;
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Get the base date (today centered + offset)
    const baseDate = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        // 初期表示で本日を左寄り(8日目)に配置して将来を広く見せる
        d.setDate(d.getDate() - 8 + dayOffset);
        return d;
    }, [dayOffset]);

    // Generate array of dates for the visible range
    const visibleDates = useMemo(() => {
        const dates = [];
        for (let i = 0; i < VISIBLE_DAYS; i++) {
            const d = new Date(baseDate);
            d.setDate(d.getDate() + i);
            dates.push(d);
        }
        return dates;
    }, [baseDate]);

    const endDate = visibleDates[visibleDates.length - 1];

    // Filter: ordered & has at least one undelivered item with dueDate
    const scheduledItems = useMemo(() => {
        const result = [];
        quotations.forEach(q => {
            if (q.status !== 'ordered') return;
            (q.items || []).forEach(item => {
                if (item.deliveryDate) return; // Already delivered
                if (!item.dueDate) return; // No due date set
                const isCompleted = (item.actualHours && Number(item.actualHours) > 0) ||
                    (item.actualProcessingCost && Number(item.actualProcessingCost) > 0) ||
                    (item.actualMaterialCost && Number(item.actualMaterialCost) > 0) ||
                    (item.actualOtherCost && Number(item.actualOtherCost) > 0);

                let scheduledStartDate = null;
                if (item.scheduledStartDate) {
                    scheduledStartDate = new Date(item.scheduledStartDate);
                } else if (isCompleted) {
                    // Default to registration date only if work has actually started
                    scheduledStartDate = new Date(q.createdAt);
                }

                result.push({
                    id: item.id, // item id
                    quotationId: q.id,
                    companyName: q.companyName || '(会社名なし)',
                    itemName: item.name || '(品名なし)',
                    quantity: item.quantity || 1,
                    dueDate: new Date(item.dueDate),
                    scheduledStartDate: item.scheduledStartDate ? new Date(item.scheduledStartDate) : null,
                    scheduledEndDate: item.scheduledEndDate ? new Date(item.scheduledEndDate) : null,
                    isCompleted: isCompleted,
                    rawQuotation: q
                });
            });
        });
        // Sort by dueDate
        result.sort((a, b) => a.dueDate - b.dueDate);
        return result;
    }, [quotations]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const formatDate = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
    const formatRangeLabel = () => `${baseDate.getFullYear()}年 ${formatDate(baseDate)} 〜 ${formatDate(endDate)}`;

    const getDayIndex = (date) => {
        const diff = (date - baseDate) / (1000 * 60 * 60 * 24);
        return Math.round(diff);
    };

    const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

    const getBarColor = (dueDate) => {
        const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        if (daysUntilDue < 0) return { bg: 'bg-red-500/80', border: 'border-red-600', text: 'text-red-400', label: '超過' };
        if (daysUntilDue <= 7) return { bg: 'bg-amber-500/80', border: 'border-amber-600', text: 'text-amber-400', label: '残' + daysUntilDue + '日' };
        return { bg: 'bg-indigo-500/70', border: 'border-indigo-600', text: 'text-indigo-400', label: '' };
    };

    const toggleSelectItem = (itemId) => {
        setSelectedItems(prev =>
            prev.includes(itemId)
                ? prev.filter(id => id !== itemId)
                : [...prev, itemId]
        );
    };

    const handleBatchDeliver = async () => {
        if (selectedItems.length === 0) return;
        if (!await showConfirm(`選択した ${selectedItems.length} 件の明細を「本日納品済み」として一括消込しますか？`)) return;

        setDeliveryProcessing(true);
        try {
            await api.post('/api/quotations/batch-delivery', {
                itemIds: selectedItems,
                deliveryDate: new Date().toISOString().split('T')[0]
            });
            setSelectedItems([]);
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error('Batch delivery failed:', err);
            await showAlert('一括納品処理に失敗しました。', 'error');
        } finally {
            setDeliveryProcessing(false);
        }
    };

    const handleDragStart = (e, item, type) => {
        if (!isAdmin) return;
        e.stopPropagation();
        
        let originalDate;
        if (type === 'start') {
            originalDate = item.scheduledStartDate ? new Date(item.scheduledStartDate) : null;
        } else if (type === 'end') {
            originalDate = item.scheduledEndDate ? new Date(item.scheduledEndDate) : (item.scheduledStartDate ? new Date(item.scheduledStartDate) : null);
        } else if (type === 'new') {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const daysFromBase = Math.floor(x / 40);
            originalDate = new Date(baseDate);
            originalDate.setDate(originalDate.getDate() + daysFromBase);
        }

        setDragState({
            itemId: item.id,
            type,
            originalDate,
            startX: e.clientX,
            moved: false
        });
    };

    const handleMouseMove = useCallback((e) => {
        if (!dragState) return;
        const diffX = e.clientX - dragState.startX;
        const daysDiff = Math.round(diffX / 40);
        setDragDaysDiff(daysDiff);
        if (Math.abs(diffX) > 5 && !dragState.moved) {
            setDragState(prev => prev ? { ...prev, moved: true } : null);
        }
    }, [dragState]);

    const handleMouseUp = useCallback(async (e) => {
        if (!dragState) return;
        const diffX = e.clientX - dragState.startX;
        const daysDiff = Math.round(diffX / 40);
        const st = dragState;
        
        if (st.moved) {
            clickBlockRef.current = true;
            setTimeout(() => { clickBlockRef.current = false; }, 100);
        }

        setDragState(null);
        setDragDaysDiff(0);

        if (st.type === 'new') {
            // daysDiff が 0 (クリックまたは微動) の場合でも1日分として登録を許可
            const d1 = new Date(st.originalDate);
            const d2 = new Date(st.originalDate);
            d2.setDate(d2.getDate() + daysDiff);
            
            const start = d1 < d2 ? d1 : d2;
            const end = d1 < d2 ? d2 : d1;

            try {
                await api.patch(`/api/quotations/items/${st.itemId}`, {
                    scheduledStartDate: toYMD(start),
                    scheduledEndDate: toYMD(end)
                });
                if (onRefresh) onRefresh();
            } catch (err) {
                console.error('Failed to create project bar:', err);
                await showAlert('バーの作成に失敗しました。', 'error');
            }
            return;
        }

        if (daysDiff === 0 || !st.originalDate) return;

        const newDate = new Date(st.originalDate);
        newDate.setDate(newDate.getDate() + daysDiff);
        const dateStr = toYMD(newDate);

        try {
            const payload = st.type === 'start' 
                ? { scheduledStartDate: dateStr } 
                : { scheduledEndDate: dateStr };
            
            await api.patch(`/api/quotations/items/${st.itemId}`, payload);
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error('Failed to update date via drag:', err);
            await showAlert('日程の更新に失敗しました。', 'error');
        }
    }, [dragState, onRefresh, showAlert, baseDate]);

    useEffect(() => {
        if (dragState) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, handleMouseMove, handleMouseUp]);

    const getPreviewDates = (item) => {
        if (!dragState || dragState.itemId !== item.id) return { start: item.scheduledStartDate, end: item.dueDate };
        
        // This is a bit tricky since mousemove doesn't trigger re-render easily without a state update.
        // But for visual feedback during drag, we might need a "tempDragOffset" state.
        // Let's add it.
        return { start: item.scheduledStartDate, end: item.dueDate }; // Placeholder
    };

    return (
        <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 shadow-xl overflow-hidden transition-all duration-500">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900/40">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                        <Calendar className="text-indigo-400" size={20} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-white leading-none">案件工程スケジュール</h2>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-bold">生産・工程スケジュール</p>
                    </div>
                    <span className="ml-2 text-xs bg-indigo-900/30 text-indigo-400 px-2.5 py-0.5 rounded-full font-black border border-indigo-800/50">
                        {scheduledItems.length}
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={handleBatchDeliver}
                        disabled={deliveryProcessing || selectedItems.length === 0}
                        className={`flex items-center gap-2 px-4 py-2 text-white rounded-xl text-xs font-black transition-all animate-in zoom-in-95 ${selectedItems.length > 0
                            ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 active:scale-95'
                            : 'bg-slate-700 opacity-50 cursor-not-allowed'
                            }`}
                    >
                        {deliveryProcessing ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : <PackageCheck size={16} />}
                        選択した {selectedItems.length || 0} 件を一括納品
                    </button>

                    <div className="flex items-center bg-slate-900/80 rounded-xl border border-slate-700 p-0.5">
                        <button onClick={() => setDayOffset(prev => prev - 7)} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-all" title="前週">
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-xs font-black text-slate-300 px-4 py-1 select-none">
                            {formatRangeLabel()}
                        </span>
                        <button onClick={() => setDayOffset(prev => prev + 7)} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-all" title="翌週">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                    <button onClick={() => setDayOffset(0)} className="px-3 py-1.5 text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
                        今日に戻る
                    </button>
                </div>
            </div>

            {scheduledItems.length === 0 ? (
                <div className="text-center py-20 bg-slate-900/20">
                    <div className="bg-slate-800/50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-700 shadow-inner">
                        <Calendar className="text-slate-600" size={32} />
                    </div>
                    <p className="text-slate-400 font-bold">進行中のスケジュールはありません</p>
                    <p className="text-[10px] text-slate-600 mt-2 uppercase tracking-widest font-black">全ての案件が納品済み、または受注待ちです</p>
                </div>
            ) : (
                <div className="max-h-[65vh] overflow-auto custom-scrollbar relative">
                    <div style={{ minWidth: `${240 + VISIBLE_DAYS * 40}px` }}>
                        {/* Date Header Row */}
                        <div className="flex sticky top-0 bg-slate-900 z-30 border-b border-slate-700 shadow-md">
                            <div className="w-[240px] shrink-0 p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-700 sticky left-0 bg-slate-900 z-40">
                                案件・顧客情報
                            </div>
                            <div className="flex flex-1">
                                {visibleDates.map((d, i) => {
                                    const isToday = d.getTime() === today.getTime();
                                    const isWkend = isWeekend(d);
                                    return (
                                        <div key={i} className={`w-10 shrink-0 text-center py-2 border-r border-slate-800/40 relative transition-colors ${isToday ? 'bg-indigo-900/20' : isWkend ? 'bg-slate-800/30' : 'hover:bg-slate-800/20'}`}>
                                            <div className={`text-[8px] font-black uppercase tracking-tighter ${isToday ? 'text-indigo-400' : isWkend ? 'text-slate-500' : 'text-slate-500'}`}>
                                                {['日', '月', '火', '水', '木', '金', '土'][d.getDay()]}
                                            </div>
                                            <div className={`text-xs font-black ${isToday ? 'text-indigo-400 scale-110' : d.getDate() === 1 ? 'text-blue-400 font-black' : 'text-slate-400'}`}>
                                                {d.getDate() === 1 ? `${d.getMonth() + 1}/1` : d.getDate()}
                                            </div>
                                            {isToday && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500" />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Rows */}
                        <div className="bg-slate-900/20">
                            {scheduledItems.map((item, rowIdx) => {
                                const barColor = getBarColor(item.dueDate);
                                const startIdx = item.scheduledStartDate ? getDayIndex(item.scheduledStartDate) : null;
                                const endIdx = item.scheduledEndDate ? getDayIndex(item.scheduledEndDate) : (item.scheduledStartDate ? getDayIndex(item.scheduledStartDate) : null);
                                const dueIdx = getDayIndex(item.dueDate);
                                const isSelected = selectedItems.includes(item.id);

                                const isDraggingThis = dragState?.itemId === item.id;
                                let barStart = startIdx !== null ? Math.max(0, Math.min(startIdx, VISIBLE_DAYS)) : null;
                                let barEnd = endIdx !== null ? Math.max(0, Math.min(endIdx + 1, VISIBLE_DAYS)) : null;

                                if (isDraggingThis) {
                                    if (dragState.type === 'start') {
                                        barStart = Math.round(Math.max(0, Math.min((startIdx || 0) + dragDaysDiff, (barEnd || VISIBLE_DAYS) - 1)));
                                    } else if (dragState.type === 'end') {
                                        barEnd = Math.round(Math.max((barStart || 0) + 1, Math.min((endIdx || 0) + 1 + dragDaysDiff, VISIBLE_DAYS)));
                                    } else if (dragState.type === 'new') {
                                        const clickDayIdx = getDayIndex(dragState.originalDate);
                                        const d1 = clickDayIdx;
                                        const d2 = clickDayIdx + dragDaysDiff;
                                        barStart = Math.max(0, Math.min(d1, d2));
                                        barEnd = Math.min(VISIBLE_DAYS, Math.max(d1, d2) + 1);
                                    }
                                }
                                const hasBar = barStart !== null && barEnd !== null && barStart < VISIBLE_DAYS && barEnd > 0 && barStart < barEnd;

                                return (
                                    <div
                                        key={`${item.quotationId}-${rowIdx}`}
                                        onClick={() => {
                                            if (!clickBlockRef.current && !dragState?.moved) {
                                                onEdit(item.rawQuotation);
                                            }
                                        }}
                                        className={`flex border-b border-slate-800/50 hover:bg-indigo-500/5 transition-all group cursor-pointer ${isSelected ? 'bg-indigo-500/10' : ''}`}
                                    >
                                        {/* Label Area */}
                                        <div className={`w-[240px] shrink-0 p-3 border-r border-slate-700/50 sticky left-0 transition-all z-10 flex gap-3 ${isSelected ? 'bg-indigo-900/40' : 'bg-slate-900/95 group-hover:bg-slate-800/90'}`}>
                                            {/* Selection Checkbox */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleSelectItem(item.id); }}
                                                className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-500 border-indigo-500 shadow-lg shadow-indigo-500/20' : 'border-slate-700 hover:border-indigo-500/50 bg-slate-800'}`}
                                            >
                                                {isSelected && <Check size={12} className="text-white font-black" />}
                                            </button>

                                            <div className="overflow-hidden">
                                                <div className="block text-left group/label p-0 bg-transparent border-none">
                                                    <div className="text-xs font-black text-white truncate leading-tight group-hover/label:text-indigo-400 transition-colors" title={item.itemName}>
                                                        {item.itemName}
                                                        <ExternalLink size={8} className="inline ml-1 opacity-100 transition-opacity text-indigo-400" />
                                                    </div>
                                                    <div className="text-[9px] font-bold text-slate-500 truncate mt-0.5">{item.companyName} · {item.quantity}pcs</div>
                                                </div>
                                                <div className={`flex items-center gap-2 mt-1.5`}>
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 ${barColor.text}`}>
                                                        納期: {item.dueDate.toLocaleDateString('ja-JP')}
                                                    </span>
                                                    {barColor.label && (
                                                        <span className={`inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${barColor.label === '超過' ? 'bg-red-500 text-white' : 'bg-amber-500 text-slate-900 animate-pulse'}`}>
                                                            {barColor.label}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Timeline Area */}
                                        <div className="flex flex-1 relative min-h-[56px]" onMouseDown={(e) => !hasBar && handleDragStart(e, item, 'new')}>
                                            {visibleDates.map((d, i) => {
                                                const isToday = d.getTime() === today.getTime();
                                                const isWkend = isWeekend(d);
                                                return (
                                                    <div key={i} className={`w-10 shrink-0 border-r border-slate-800/30 relative ${isToday ? 'bg-indigo-500/5' : isWkend ? 'bg-slate-800/10' : ''}`}>
                                                        {isToday && <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-indigo-500/20 z-10" />}
                                                    </div>
                                                );
                                            })}

                                            {/* Bar */}
                                            {hasBar && (
                                                <div
                                                    className={`absolute top-3 h-7 ${barColor.bg} ${barColor.border} border rounded-lg shadow-lg flex items-center justify-between group-hover:brightness-110 active:shadow-md transition-all z-20 overflow-hidden`}
                                                    style={{
                                                        left: `${barStart * 40}px`,
                                                        width: `${(barEnd - barStart) * 40}px`,
                                                        backgroundImage: item.isCompleted ? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.05), rgba(255,255,255,0.05) 10px, transparent 10px, transparent 20px)' : 'none'
                                                    }}
                                                >
                                                    {/* Resize Handle: Start */}
                                                    {isAdmin && !item.isCompleted && (
                                                        <div 
                                                            onMouseDown={(e) => handleDragStart(e, item, 'start')}
                                                            className="absolute left-0 top-0 bottom-0 w-2.5 bg-white/10 hover:bg-white/30 cursor-col-resize flex items-center justify-center transition-colors z-30"
                                                            title="着手予定日を変更"
                                                        >
                                                            <div className="w-[1px] h-3 bg-white/40" />
                                                        </div>
                                                    )}

                                                    <div className="flex items-center gap-2 px-3 truncate flex-1 min-w-0 pointer-events-none">
                                                        {item.isCompleted ? (
                                                            <div className="p-0.5 bg-emerald-500 rounded">
                                                                <Check size={10} className="text-white" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                                        )}
                                                        <span className="text-[10px] font-black truncate tracking-tight text-white">
                                                            {item.itemName}
                                                        </span>
                                                    </div>

                                                    {/* Resize Handle: End */}
                                                    {isAdmin && !item.isCompleted && (
                                                        <div 
                                                            onMouseDown={(e) => handleDragStart(e, item, 'end')}
                                                            className="absolute right-0 top-0 bottom-0 w-2.5 bg-white/10 hover:bg-white/30 cursor-col-resize flex items-center justify-center transition-colors z-30"
                                                            title="完了予定日を変更"
                                                        >
                                                            <div className="w-[1px] h-3 bg-white/40" />
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Due date marker */}
                                            {dueIdx >= 0 && dueIdx < VISIBLE_DAYS && (
                                                <div className="absolute top-0 z-30 flex flex-col items-center" style={{ left: `${dueIdx * 40 + 10}px` }}>
                                                    <div className={`${barColor.text} text-[12px] font-black leading-none drop-shadow-md`}>▼</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="p-4 border-t border-slate-700 flex flex-wrap gap-6 text-[9px] font-bold text-slate-500 bg-slate-900/60 transition-all">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-2 bg-indigo-500/70 border border-indigo-600 rounded-sm" />
                    <span className="uppercase tracking-widest">標準スケジュール</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-2 bg-amber-500/80 border border-amber-600 rounded-sm" />
                    <span className="uppercase tracking-widest text-amber-500/80">1週間以内</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-2 bg-red-500/80 border border-red-600 rounded-sm" />
                    <span className="uppercase tracking-widest text-red-500/80">納期超過</span>
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-indigo-400 font-black">▼</span>
                    <span className="uppercase tracking-widest">納期</span>
                </div>
                <div className="flex items-center gap-1.5 border-l border-slate-700 pl-4">
                    <div className="w-0.5 h-3 bg-indigo-500/40" />
                    <span className="uppercase tracking-widest">今日</span>
                </div>
            </div>
        </div>
    );
}
