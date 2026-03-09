import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCw, Trash2, Save, MoveHorizontal, RefreshCcw, FileText, AlertCircle } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument, degrees } from 'pdf-lib';
import { useNotification } from '../contexts/NotificationContext';

// PDF.js options to suppress XFA and optimize loading
const PDF_OPTIONS = {
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    disableXFA: true,
    enableXfa: false,
};

export default function PdfEditorModal({ isOpen, onClose, file, onSave }) {
    const { showAlert, showConfirm } = useNotification();
    const [numPages, setNumPages] = useState(null);
    const [pagesState, setPagesState] = useState([]); // { index: number, rotation: number, isDeleted: boolean }
    const [isSaving, setIsSaving] = useState(false);
    const [pdfError, setPdfError] = useState(null);

    // File object or URL
    const [fileUrl, setFileUrl] = useState(null);

    useEffect(() => {
        if (!isOpen || !file) return;

        // Ensure worker is set (usually done in main.jsx, but good to ensure)
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
            pdfjs.GlobalWorkerOptions.workerSrc = new URL(
                'pdfjs-dist/build/pdf.worker.min.mjs',
                import.meta.url,
            ).toString();
        }

        setPdfError(null);
        if (file instanceof File || file instanceof Blob) {
            const url = URL.createObjectURL(file);
            setFileUrl(url);
            return () => URL.revokeObjectURL(url);
        } else if (typeof file === 'string') {
            setFileUrl(file);
        }
    }, [isOpen, file]);

    // 背景スクロールロック
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = 'auto';
            };
        }
    }, [isOpen]);

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
        // Initialize state for each page
        const initialPages = Array.from(new Array(numPages), (el, index) => ({
            index: index,     // original page index (0-based internally for pdf-lib, though react-pdf is 1-based)
            rotation: 0,
            isDeleted: false,
        }));
        setPagesState(initialPages);
    };

    const handleRotate = (indexToRotate) => {
        setPagesState(prev => prev.map((p, i) => {
            if (i === indexToRotate) {
                return { ...p, rotation: (p.rotation + 90) % 360 };
            }
            return p;
        }));
    };

    const handleDeleteToggle = (indexToToggle) => {
        setPagesState(prev => prev.map((p, i) => {
            if (i === indexToToggle) {
                return { ...p, isDeleted: !p.isDeleted };
            }
            return p;
        }));
    };

    const handleDragStart = (e, index) => {
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e, targetIndex) => {
        e.preventDefault();
        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (sourceIndex === targetIndex) return;

        setPagesState(prev => {
            const newState = [...prev];
            const [movedItem] = newState.splice(sourceIndex, 1);
            newState.splice(targetIndex, 0, movedItem);
            return newState;
        });
    };

    const handleSave = async () => {
        const activePages = pagesState.filter(p => !p.isDeleted);
        if (activePages.length === 0) {
            showAlert('エラー', '保存するページが選択されていません。');
            return;
        }

        setIsSaving(true);
        try {
            // Load original PDF using pdf-lib
            let existingPdfBytes;
            if (file instanceof File || file instanceof Blob) {
                existingPdfBytes = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(reader.error);
                    reader.readAsArrayBuffer(file);
                });
            } else if (typeof file === 'string') {
                const res = await fetch(fileUrl);
                existingPdfBytes = await res.arrayBuffer();
            }

            if (!existingPdfBytes) {
                throw new Error('PDFデータの取得に失敗しました');
            }

            const originPdfDoc = await PDFDocument.load(existingPdfBytes);
            const newPdfDoc = await PDFDocument.create();

            const pageIndicesToCopy = activePages.map(p => p.index);
            const copiedPages = await newPdfDoc.copyPages(originPdfDoc, pageIndicesToCopy);

            copiedPages.forEach((copiedPage, idx) => {
                const pageState = activePages[idx];
                const currentRotationAngle = copiedPage.getRotation().angle;
                if (pageState.rotation !== 0) {
                    const newAngle = (currentRotationAngle + pageState.rotation) % 360;
                    copiedPage.setRotation(degrees(newAngle));
                }
                newPdfDoc.addPage(copiedPage);
            });

            const pdfBytes = await newPdfDoc.save();
            const originalName = file.name || 'edited_document.pdf';
            const newFile = new File([pdfBytes], originalName, { type: 'application/pdf' });

            onSave(newFile);
            onClose();
        } catch (err) {
            console.error('Error saving edited PDF:', err);
            showAlert('エラー', 'PDFの保存に失敗しました。詳細なエラーはコンソールをご確認ください。');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                            <FileText className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white leading-tight">PDFファイルの編集</h2>
                            <p className="text-xs text-slate-400">ドラッグ＆ドロップで並び替え、回転、不要なページの削除が可能です</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-950/50">
                    {fileUrl && (
                        <div className="hidden">
                            <Document
                                file={fileUrl}
                                onLoadSuccess={onDocumentLoadSuccess}
                                onLoadError={(e) => setPdfError(e.message)}
                                options={PDF_OPTIONS}
                            />
                        </div>
                    )}

                    {pdfError && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            <span>PDFの読み込みに失敗しました: {pdfError}</span>
                        </div>
                    )}

                    {!numPages && !pdfError && (
                        <div className="flex items-center justify-center h-full">
                            <RefreshCcw className="w-8 h-8 text-blue-500 animate-spin" />
                            <span className="ml-3 text-slate-400">PDFを読み込み中...</span>
                        </div>
                    )}

                    {numPages && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {pagesState.map((pageState, index) => (
                                <div
                                    key={`page-${pageState.index}-${index}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, index)}
                                    className={`relative group bg-slate-800 rounded-xl border-2 transition-all cursor-move
                                    ${pageState.isDeleted ? 'border-red-500/50 opacity-40' : 'border-slate-700 hover:border-blue-500/50'}`}
                                >
                                    {/* Page Number Badge */}
                                    <div className="absolute top-2 left-2 px-2 py-1 bg-slate-900/80 text-xs font-bold text-slate-300 rounded shadow-sm z-10 backdrop-blur-sm pointer-events-none">
                                        {index + 1}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="absolute top-2 right-2 flex flex-col gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleRotate(index); }}
                                            className="p-1.5 bg-slate-700 text-white rounded hover:bg-blue-500 transition-colors shadow-lg"
                                            title="回転 (90度)"
                                        >
                                            <RotateCw className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteToggle(index); }}
                                            className={`p-1.5 text-white rounded transition-colors shadow-lg ${pageState.isDeleted ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-700 hover:bg-red-500'
                                                }`}
                                            title={pageState.isDeleted ? "復元" : "削除"}
                                        >
                                            {pageState.isDeleted ? <RefreshCcw className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                                        </button>
                                    </div>

                                    {/* Thumbnail Preview */}
                                    <div className="w-full aspect-[1/1.414] overflow-hidden rounded-lg flex items-center justify-center bg-white p-2"
                                        style={{ transform: `rotate(${pageState.rotation}deg)`, transition: 'transform 0.3s ease' }}>
                                        <Document file={fileUrl} className="flex justify-center w-full h-full pointer-events-none" options={PDF_OPTIONS}>
                                            <Page
                                                pageNumber={pageState.index + 1}
                                                width={200}
                                                renderTextLayer={false}
                                                renderAnnotationLayer={false}
                                                className="shadow-sm"
                                            />
                                        </Document>
                                    </div>

                                    {pageState.isDeleted && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="bg-red-500 text-white px-3 py-1 rounded font-bold rotate-[-15deg] text-sm">
                                                削除対象
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                        disabled={isSaving}
                    >
                        キャンセル
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving || !numPages}
                        className="px-6 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? (
                            <><RefreshCcw className="w-4 h-4 animate-spin" /> 保存中...</>
                        ) : (
                            <><Save className="w-4 h-4" /> 変更を保存して適用</>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
