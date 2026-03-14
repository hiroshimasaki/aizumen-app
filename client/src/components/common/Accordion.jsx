import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function Accordion({ title, icon, children, defaultOpen = false, count = null }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const contentRef = useRef(null);
    const [contentHeight, setContentHeight] = useState('0px');

    useEffect(() => {
        if (isOpen) {
            setContentHeight(`${contentRef.current.scrollHeight}px`);
        } else {
            setContentHeight('0px');
        }
    }, [isOpen, children]);

    return (
        <div className={cn(
            "border border-slate-700/50 rounded-2xl overflow-hidden transition-all duration-300",
            isOpen ? "bg-slate-800/30 ring-1 ring-slate-700/50 shadow-lg" : "bg-slate-800/10 hover:bg-slate-800/20"
        )}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-5 text-left transition-colors"
            >
                <div className="flex items-center gap-4">
                    {icon && (
                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center border transition-all",
                            isOpen ? "bg-indigo-500/20 border-indigo-500/50" : "bg-slate-700/30 border-slate-600 text-slate-400"
                        )}>
                            {icon}
                        </div>
                    )}
                    <div>
                        <h3 className={cn(
                            "text-sm font-black uppercase tracking-widest transition-colors",
                            isOpen ? "text-white" : "text-slate-400"
                        )}>
                            {title}
                        </h3>
                        {count !== null && (
                            <span className="text-[10px] text-slate-500 font-bold">{count} 件のデータ</span>
                        )}
                    </div>
                </div>
                <div className={cn(
                    "p-2 rounded-lg bg-slate-700/30 text-slate-500 transition-all duration-300",
                    isOpen && "rotate-180 bg-indigo-500/10 text-indigo-400"
                )}>
                    <ChevronDown size={18} />
                </div>
            </button>
            <div
                ref={contentRef}
                style={{ maxHeight: contentHeight }}
                className="transition-all duration-300 ease-in-out overflow-hidden"
            >
                <div className="p-5 pt-0 border-t border-slate-700/30 animate-in fade-in duration-500">
                    {children}
                </div>
            </div>
        </div>
    );
}
