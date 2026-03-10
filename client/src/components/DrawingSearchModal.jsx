import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Sparkles, RefreshCcw, AlertCircle, Check, DollarSign, ZoomIn, ZoomOut, Maximize, FileText } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

// PDF.js options to suppress XFA and optimize loading
const PDF_OPTIONS = {
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    disableXFA: true,
    enableXfa: false,
};

export default function DrawingSearchModal({ isOpen, onClose, file, onApplyResult, initialResults, onSaveResults, initialQueryPreview, onSaveQueryPreview }) {
    const { setCredits } = useAuth();
    const { showAlert } = useNotification();
    const [numPages, setNumPages] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState(initialResults || []);
    const [selection, setSelection] = useState(null); // { x, y, width, height }
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [queryPreview, setQueryPreview] = useState(initialQueryPreview || null); // クエリ画像のプレビュー
    const [scale, setScale] = useState(1.0); // ズーム倍率
    
    // プログレスバー用のステート
    const [searchProgress, setSearchProgress] = useState(0);
    const [searchStatusText, setSearchStatusText] = useState('');

    const containerRef = useRef(null);
    const [fileUrl, setFileUrl] = useState(null);

    useEffect(() => {
        if (!isOpen || !file) return;

        // キャッシュがあればセット、なければ初期化
        if (initialResults && initialResults.length > 0) {
            setResults(initialResults);
        } else {
            setResults([]);
        }

        setSelection(null);
        setQueryPreview(initialQueryPreview || null); // キャッシュがあれば復元
        setScale(1.0); // ズームリセット

        if (file instanceof File || file instanceof Blob) {
            const url = URL.createObjectURL(file);
            setFileUrl(url);
            return () => URL.revokeObjectURL(url);
        } else if (typeof file === 'string') {
            setFileUrl(file);
        }
    }, [isOpen, file, initialResults]);

    // Handle mouse events for rectangular selection
    const handleMouseDown = (e) => {
        if (!containerRef.current || isSearching) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setStartPos({ x, y });
        setSelection({ x, y, width: 0, height: 0 });
        setIsDrawing(true);
    };

    const handleMouseMove = (e) => {
        if (!isDrawing || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const curX = e.clientX - rect.left;
        const curY = e.clientY - rect.top;

        const x = Math.min(startPos.x, curX);
        const y = Math.min(startPos.y, curY);
        const width = Math.abs(curX - startPos.x);
        const height = Math.abs(curY - startPos.y);

        setSelection({ x, y, width, height });
    };

    const handleMouseUp = () => {
        setIsDrawing(false);
    };

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
    const handleZoomReset = () => setScale(1.0);

    const performSearch = async () => {
        if (!selection || selection.width < 5 || selection.height < 5) {
            showAlert('範囲をドラッグして選択してください。', 'warning');
            return;
        }

        setIsSearching(true);
        setSearchProgress(5);
        setSearchStatusText('検索の準備中...');
        
        // 擬似的な進捗アップデートのタイマー
        const progressPhases = [
            { time: 1000, prog: 15, text: 'クエリ画像の特徴量ベクトルを生成中...' },
            { time: 3000, prog: 35, text: 'データベース上で類似図面を検索中...' },
            { time: 5000, prog: 55, text: 'AI(Gemini)用比較データの準備中...' },
            { time: 6500, prog: 75, text: 'AI(Gemini)による図面構造の精密比較・スコアリング中...' },
            { time: 12000, prog: 90, text: '結果の抽出とサムネイル生成中...' },
        ];
        
        const timers = progressPhases.map(phase => 
            setTimeout(() => {
                setSearchProgress(phase.prog);
                setSearchStatusText(phase.text);
            }, phase.time)
        );

        try {
            const cropCanvas = document.createElement('canvas');
            const pageCanvas = containerRef.current.querySelector('canvas');
            if (!pageCanvas) throw new Error('PDF Canvas not found');

            const ctx = cropCanvas.getContext('2d');

            const internalScale = pageCanvas.width / containerRef.current.clientWidth;

            cropCanvas.width = selection.width * internalScale;
            cropCanvas.height = selection.height * internalScale;

            ctx.drawImage(
                pageCanvas,
                selection.x * internalScale, selection.y * internalScale, selection.width * internalScale, selection.height * internalScale,
                0, 0, selection.width * internalScale, selection.height * internalScale
            );

            const blob = await new Promise(resolve => cropCanvas.toBlob(resolve, 'image/png'));
            const blobUrl = URL.createObjectURL(blob);
            setQueryPreview(blobUrl); 
            if (onSaveQueryPreview) onSaveQueryPreview(blobUrl);

            const formData = new FormData();
            formData.append('queryImage', blob, 'query.png');

            const { data } = await api.post('/api/search/similar', formData, { timeout: 120000 });
            
            // 検索成功時
            timers.forEach(clearTimeout);
            setSearchProgress(100);
            setSearchStatusText('検索完了！');
            
            setResults(data.results || []);

            if (onSaveResults) {
                onSaveResults(data.results || []);
            }

            if (data.creditStats && setCredits) {
                setCredits(prev => ({
                    ...prev,
                    balance: data.creditStats.remainingBalance,
                    purchased_balance: data.creditStats.purchasedBalance !== undefined ? data.creditStats.purchasedBalance : prev.purchased_balance
                }));
            }

        } catch (err) {
            console.error('Search error:', err);
            timers.forEach(clearTimeout);
            showAlert('検索に失敗しました。', 'error');
        } finally {
            // 少し待ってからプログレス状態をリセット（完了アニメーションを見せるため）
            setTimeout(() => {
                setIsSearching(false);
                setSearchProgress(0);
                setSearchStatusText('');
            }, 500);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                            <Search className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">図面類似箇所検索</h2>
                            <p className="text-xs text-slate-400">図面上の検索したい範囲をマウスで囲んでください（拡大縮小可）</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Zoom Controls */}
                        <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
                            <button onClick={handleZoomOut} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="縮小">
                                <ZoomOut size={18} />
                            </button>
                            <span className="px-3 text-xs font-bold text-slate-300 min-w-[60px] text-center">
                                {Math.round(scale * 100)}%
                            </span>
                            <button onClick={handleZoomIn} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="拡大">
                                <ZoomIn size={18} />
                            </button>
                            <div className="w-px h-4 bg-slate-700 mx-1" />
                            <button onClick={handleZoomReset} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="リセット">
                                <Maximize size={18} />
                            </button>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 flex overflow-hidden">
                    {/* PDF Area */}
                    <div className="flex-1 bg-slate-950 overflow-auto relative p-8 flex justify-center items-start custom-scrollbar">
                        <div
                            ref={containerRef}
                            className="relative cursor-crosshair shadow-2xl rounded-lg overflow-hidden"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            style={{ width: 700 * scale }}
                        >
                            <Document
                                file={fileUrl}
                                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                                loading={<div className="p-20 text-slate-500 flex flex-col items-center gap-4"><RefreshCcw className="animate-spin" />読み込み中...</div>}
                                options={PDF_OPTIONS}
                            >
                                <Page
                                    pageNumber={currentPage}
                                    width={700 * scale}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                />
                            </Document>

                            {/* Selection Overlay */}
                            {selection && (
                                <div
                                    className="absolute border-2 border-cyan-400 bg-cyan-400/10 pointer-events-none ring-2 ring-cyan-400/20"
                                    style={{
                                        left: selection.x,
                                        top: selection.y,
                                        width: selection.width,
                                        height: selection.height
                                    }}
                                >
                                    <div className="absolute -top-6 left-0 bg-cyan-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-widest whitespace-nowrap shadow-lg">
                                        検索範囲 {Math.round(selection.width)}x{Math.round(selection.height)}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Results Area */}
                    <div className="w-96 border-l border-slate-800 flex flex-col bg-slate-900/50">
                        <div className="p-5 border-b border-slate-800 bg-slate-900 space-y-4">
                            {queryPreview && (
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">検索クエリ画像</span>
                                    <div className="bg-slate-950 rounded-xl border border-slate-700 overflow-hidden flex items-center justify-center h-32">
                                        <img src={queryPreview} alt="Query" className="max-w-full max-h-full object-contain" />
                                    </div>
                                </div>
                            )}
                            <button
                                onClick={performSearch}
                                disabled={isSearching || !selection}
                                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-900/20"
                            >
                                {isSearching ? <RefreshCcw className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />}
                                {isSearching ? '検索中...' : 'この範囲で検索'}
                            </button>
                            
                            {/* プログレスバーの表示エリア */}
                            {isSearching && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex justify-between items-end">
                                        <span className="text-xs font-medium text-cyan-400">{searchStatusText}</span>
                                        <span className="text-xs font-bold text-slate-400">{searchProgress}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                                        <div 
                                            className="h-full bg-cyan-500 transition-all duration-500 ease-out relative"
                                            style={{ width: `${searchProgress}%` }}
                                        >
                                            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                            {results.length === 0 && !isSearching && (
                                <div className="text-center py-10 opacity-50">
                                    <AlertCircle className="w-10 h-10 mx-auto mb-3" />
                                    <p className="text-sm">検索結果がありません。<br />範囲を選択して検索してください。</p>
                                </div>
                            )}

                            {results.map((res, i) => (
                                <SearchResultItem key={i} res={res} index={i} onApplyResult={onApplyResult} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

// 検索結果の各項目を表示するサブコンポーネント（フックの規則を守るため分離）
function SearchResultItem({ res, index, onApplyResult }) {
    const [thumbBlobUrl, setThumbBlobUrl] = useState(null);

    useEffect(() => {
        if (!res.thumbnailUrl) return;
        let active = true;

        const fetchThumb = async () => {
            try {
                const { data } = await api.get(res.thumbnailUrl, { responseType: 'blob' });
                if (active) {
                    const url = URL.createObjectURL(data);
                    setThumbBlobUrl(url);
                }
            } catch (err) {
                console.error('Thumbnail fetch error:', err);
            }
        };

        fetchThumb();
        return () => {
            active = false;
            // Note: In a real app, you might want a more sophisticated way to manage these URLs
            // but for a modal it's generally fine to revoke on unmount.
            if (thumbBlobUrl) URL.revokeObjectURL(thumbBlobUrl);
        };
    }, [res.thumbnailUrl]);

    const handleDownload = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fileId = res.file_id || res.id;
        if (!fileId) return;

        try {
            const { data } = await api.get(`/api/files/download/${fileId}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', res.original_name || 'drawing.pdf');
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            console.error('Download failed:', err);
        }
    };

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden hover:border-cyan-500/50 transition-colors group">
            {/* Thumbnail comparison (Simplified: Highlight removed as requested) */}
            {thumbBlobUrl && (
                <div className="bg-white flex items-center justify-center h-48 border-b border-slate-700">
                    <img src={thumbBlobUrl} alt={`Candidate ${index}`} className="max-w-full max-h-full object-contain" />
                </div>
            )}
            <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${res.ai_score >= 80 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {res.ai_score ?? 0}%
                        </div>
                        <span className="text-xs font-bold text-slate-300">一致率</span>
                    </div>
                    <span className="text-[10px] text-slate-500">ID: {res.quotation_id}</span>
                </div>
                
                {res.original_name && (
                    <div className="px-1">
                        <button 
                            onClick={handleDownload}
                            className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1.5 transition-colors font-medium truncate w-full"
                            title="この図面を開く（ダウンロード）"
                        >
                            <FileText size={12} className="shrink-0" />
                            <span className="truncate">{res.original_name}</span>
                        </button>
                    </div>
                )}

                <div className="bg-slate-900/50 p-2.5 rounded-lg">
                    <p className="text-[11px] text-slate-300 leading-relaxed font-medium">「{res.ai_reason || '一致箇所が見つかりました'}」</p>
                </div>
                <button
                    className="w-full py-2.5 bg-cyan-600/10 hover:bg-cyan-600 text-cyan-400 hover:text-white border border-cyan-500/20 hover:border-cyan-500 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                    onClick={() => onApplyResult(res)}
                >
                    <Check className="w-3 h-3" />
                    この情報を流用
                </button>
            </div>
        </div>
    );
}
