import { Zap, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * メンテナンス中ページ
 */
export default function MaintenancePage({ message }) {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#000000] flex items-center justify-center p-6 font-sans">
            <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-700">
                {/* Visual Icon */}
                <div className="relative inline-block">
                    <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto ring-1 ring-blue-500/20 shadow-[0_0_50px_rgba(59,130,246,0.15)]">
                        <Zap className="w-10 h-10 text-blue-500 animate-pulse" />
                    </div>
                    <div className="absolute -top-1 -right-1">
                        <div className="w-4 h-4 bg-amber-500 rounded-full border-4 border-black flex items-center justify-center shadow-lg shadow-amber-500/20">
                            <AlertTriangle className="w-2 h-2 text-black" />
                        </div>
                    </div>
                </div>

                {/* Text Content */}
                <div className="space-y-4">
                    <h1 className="text-3xl font-black text-white tracking-tight">
                        System Maintenance
                    </h1>
                    <div className="space-y-4">
                        <p className="text-slate-400 text-sm leading-relaxed px-4">
                            {message || "現在システムメンテナンス中です。より良いサービス提供のため、アップデートを行っております。"}
                        </p>
                        <div className="py-3 px-4 bg-white/5 border border-white/10 rounded-2xl text-[11px] text-slate-500 font-medium inline-block mx-auto uppercase tracking-widest">
                            Estimated recovery: SOON
                        </div>
                    </div>
                </div>

                {/* Footer / Actions */}
                <div className="pt-8 flex flex-col items-center gap-4">
                    <button 
                        onClick={() => window.location.reload()}
                        className="px-8 py-3 bg-white text-black font-bold rounded-full text-sm hover:bg-slate-200 transition-all active:scale-95 shadow-xl shadow-white/5"
                    >
                        再読み込み
                    </button>
                    
                    <button 
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-xs font-bold"
                    >
                        <ArrowLeft size={14} /> トップページへ
                    </button>
                </div>

                {/* App Branding */}
                <div className="pt-12">
                    <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent opacity-30">
                        AiZumen
                    </span>
                </div>
            </div>
        </div>
    );
}
