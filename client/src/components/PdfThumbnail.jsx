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
    const [thumbUrl, setThumbUrl] = useState(null);
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef(null);
    const isComponentMounted = useRef(true);

    useEffect(() => {
        isComponentMounted.current = true;

        const isMobile = window.innerWidth < 768;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && isComponentMounted.current) {
                    setIsVisible(true);
                    observer.disconnect(); // 一度表示されたら監視終了
                }
            },
            { rootMargin: isMobile ? '200px' : '400px' }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            isComponentMounted.current = false;
            observer.disconnect();
        };
    }, []);

    // サーバーサイド・サムネイルの取得
    useEffect(() => {
        if (isVisible && fileId && !thumbUrl && !hasError) {
            setIsLoading(true);
            api.get(`/api/files/thumbnail/${fileId}`)
                .then(res => {
                    if (isComponentMounted.current) {
                        setThumbUrl(res.data.url);
                        setIsLoading(false);
                    }
                })
                .catch(err => {
                    console.error('Failed to get server thumbnail:', err);
                    if (isComponentMounted.current) {
                        setHasError(true);
                        setIsLoading(false);
                    }
                });
        }
    }, [isVisible, fileId, thumbUrl, hasError]);

    if (hasError) {
        return (
            <div className="flex flex-col items-center justify-center bg-slate-800/10 text-slate-500 w-full h-full rounded">
                <FileText size={20} className="opacity-50" />
                <span className="text-[10px] mt-1 opacity-50">プレビュー不可</span>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative overflow-hidden w-full h-full flex items-center justify-center transition-opacity duration-300 bg-slate-800/5",
                isLoading && isVisible ? "animate-pulse" : ""
            )}
        >
            {isVisible && thumbUrl ? (
                <img
                    src={thumbUrl}
                    alt="図面プレビュー"
                    className="w-full h-full object-contain"
                    onLoad={() => setIsLoading(false)}
                    onError={() => setHasError(true)}
                />
            ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 opacity-40">
                    <FileText size={20} />
                    <span className="text-[10px] mt-1">{isLoading ? '読込中' : '待機中'}</span>
                </div>
            )}
        </div>
    );
});

export default PdfThumbnail;
