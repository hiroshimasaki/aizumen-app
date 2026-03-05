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
