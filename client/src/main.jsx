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

// Suppress noisy PDF worker warnings and specific errors
const suppressList = [
    'XFA - an error occurred during parsing',
    'XFA forms are not supported',
    'XFA - an error occurred during parsing of rich text',
    'Worker was terminated',
    'cancelled',
    'destroyed',
    'Loading aborted',
    'component is unmounted'
];

const originalWarn = console.warn;
console.warn = (...args) => {
    const message = args[0]?.toString() || '';
    if (suppressList.some(s => message.includes(s))) return;
    originalWarn.apply(console, args);
};

const originalError = console.error;
console.error = (...args) => {
    const message = args[0]?.toString() || '';
    if (suppressList.some(s => message.includes(s))) return;
    originalError.apply(console, args);
};

// Suppress noisy PDF worker termination errors during unmount/scroll
window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason?.message || (typeof reason === 'string' ? reason : '');

    // PDF.js related noise that can be ignored during rapid transitions
    if (
        message.includes('Worker was terminated') ||
        message.includes('cancelled') ||
        message.includes('destroyed') ||
        message.includes('component is unmounted') ||
        message.includes('Loading aborted')
    ) {
        event.preventDefault();
        event.stopPropagation();
    }
});

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>
);
