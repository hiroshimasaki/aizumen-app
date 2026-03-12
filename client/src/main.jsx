import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { pdfjs } from 'react-pdf';

// PDF Worker setup for Vite
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

// PDF.js verbosity to minimize noisy internal logs
pdfjs.verbosity = 0; // 0 = ERRORS (ignore warnings/infos)

// Suppress noisy PDF worker warnings and specific errors
const suppressList = [
    'XFA - an error occurred during parsing',
    'XFA forms are not supported',
    'XFA - an error occurred during parsing of rich text',
    'Worker was terminated',
    'cancelled',
    'destroyed',
    'Loading aborted',
    'component is unmounted',
    'attributes\' of \'r\' as it is null',
    'Invalid XFA rich text',
    'Cannot destructure property'
];

const checkAndSuppress = (args, originalFn) => {
    const isSuppressed = args.some(arg => {
        if (!arg) return false;
        // Stringify everything to be safe
        const msg = (typeof arg === 'string' ? arg : (arg.message || JSON.stringify(arg) || '')).toLowerCase();
        return suppressList.some(s => msg.includes(s.toLowerCase()));
    });
    if (!isSuppressed) {
        originalFn.apply(console, args);
    }
};

const originalWarn = console.warn;
console.warn = (...args) => checkAndSuppress(args, originalWarn);

const originalError = console.error;
console.error = (...args) => checkAndSuppress(args, originalError);

// Aggressively suppress unhandled rejections from pdf.worker
window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (!reason) return;
    
    // エラーメッセージまたはスタックトレースから判定
    const message = reason.message || (typeof reason === 'string' ? reason : '');
    const stack = reason.stack || '';
    const fullContent = (message + stack).toLowerCase();

    // PDF.js 関連の「実害のない」クリーンアップエラーを特定
    const isPdfNoise = suppressList.some(s => fullContent.includes(s.toLowerCase())) ||
                       fullContent.includes('pdf.worker');

    if (isPdfNoise) {
        event.preventDefault();
        event.stopImmediatePropagation();
    }
}, true);

// Suppress synchronous errors from the same sources
window.onerror = (message, source, lineno, colno, error) => {
    const fullContent = `${message} ${source} ${error?.stack || ''}`.toLowerCase();
    const isPdfNoise = suppressList.some(s => fullContent.includes(s.toLowerCase())) ||
                       fullContent.includes('pdf.worker');

    if (isPdfNoise) {
        return true; // Stop event propagation
    }
    return false;
};

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>
);
