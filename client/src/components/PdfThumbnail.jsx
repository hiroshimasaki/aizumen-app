import { useState, useEffect, useRef, memo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileText, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import api from '../lib/api';

// PDF.js options to suppress XFA and optimize loading
const PDF_OPTIONS = {
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
    disableXFA: true,
    enableXfa: false,
};

const PdfThumbnail = memo(function PdfThumbnail({ fileId }) {
    const [url, setUrl] = useState(null);
    const [numPages, setNumPages] = useState(null);
    const [hasError, setHasError] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef(null);
    const isComponentMounted = useRef(true);
    const [aspectRatio, setAspectRatio] = useState(1.414);
    const visibilityTimeoutRef = useRef(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        isComponentMounted.current = true;

        // コンテナのサイズ監視
        const resizeObserver = new ResizeObserver((entries) => {
            if (entries[0] && isComponentMounted.current) {
                const width = entries[0].contentRect.width;
                // 量子化: 40px単位で丸めることで、微細なサイズ変化によるPDF再レンダリングを抑制
                setContainerWidth(Math.max(100, Math.round(width / 40) * 40));
            }
        });

        const isMobile = window.innerWidth < 768;
        const visibilityObserver = new IntersectionObserver(
            ([entry]) => {
                if (!isComponentMounted.current) return;

                if (entry.isIntersecting) {
                    if (visibilityTimeoutRef.current) {
                        clearTimeout(visibilityTimeoutRef.current);
                        visibilityTimeoutRef.current = null;
                    }
                    setIsVisible(true);
                } else {
                    if (visibilityTimeoutRef.current) clearTimeout(visibilityTimeoutRef.current);
                    visibilityTimeoutRef.current = setTimeout(() => {
                        if (isComponentMounted.current) {
                            setIsVisible(false);
                        }
                    }, isMobile ? 300 : 800); // モバイルは早めにリソース解放
                }
            },
            { rootMargin: isMobile ? '200px' : '400px' } // モバイルは先行読み込みを控えめに
        );

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
            visibilityObserver.observe(containerRef.current);
        }

        return () => {
            isComponentMounted.current = false;
            if (visibilityTimeoutRef.current) clearTimeout(visibilityTimeoutRef.current);
            resizeObserver.disconnect();
            visibilityObserver.disconnect();
        };
    }, []);

    // 署名付きURLを取得
    useEffect(() => {
        if (isVisible && fileId && !url && !hasError) {
            api.get(`/api/files/${fileId}`)
                .then(res => {
                    if (isComponentMounted.current) setUrl(res.data.url);
                })
                .catch(err => {
                    console.error('Failed to get signed URL for thumbnail:', err);
                    if (isComponentMounted.current) setHasError(true);
                });
        }
    }, [isVisible, fileId, url, hasError]);

    function onDocumentLoadSuccess({ numPages }) {
        if (isComponentMounted.current) setNumPages(numPages);
    }

    function onDocumentLoadError(error) {
        if (!isComponentMounted.current || error.message?.includes('terminated')) {
            return;
        }
        setHasError(true);
    }

    function onPageLoadSuccess(page) {
        if (page.originalWidth && page.originalHeight) {
            setAspectRatio(page.originalHeight / page.originalWidth);
        } else if (page.getViewport) {
            const vp = page.getViewport({ scale: 1 });
            if (vp.width && vp.height) setAspectRatio(vp.height / vp.width);
        }
    }

    if (hasError) {
        return (
            <div className="flex flex-col items-center justify-center bg-slate-800/10 text-slate-500 w-full h-full rounded">
                <FileText size={24} />
                <span className="text-[10px] mt-1">PDFプレビュー不可</span>
            </div>
        );
    }

    // レンダリングに使用する幅
    const drawWidth = containerWidth || 300;

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative overflow-hidden w-full h-full flex items-center justify-center transition-opacity duration-300",
                isVisible && !url ? "animate-pulse bg-slate-800/20" : "bg-transparent"
            )}
            style={{ contain: 'strict' }}
        >
            {isVisible && url && drawWidth > 0 ? (
                <Document
                    file={url}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    options={PDF_OPTIONS}
                    loading={
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800/40 z-10">
                            <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                        </div>
                    }
                    error={
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 z-10 p-2 text-center">
                            <AlertCircle size={20} className="text-rose-500" />
                        </div>
                    }
                >
                    <Page
                        pageNumber={1}
                        width={drawWidth}
                        onLoadSuccess={onPageLoadSuccess}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        loading={<div className="w-full h-full" />}
                    />
                </Document>
            ) : (
                <div className="flex flex-col items-center justify-center text-slate-300 opacity-50 w-full h-full">
                    <FileText size={24} className="opacity-10 mb-2" />
                    <span className="text-[10px] opacity-20">{!isVisible ? 'スクロールで読込' : '読込中'}</span>
                </div>
            )}
        </div>
    );
});

export default PdfThumbnail;
