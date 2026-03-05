import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
    const [alert, setAlert] = useState(null);
    const [confirm, setConfirm] = useState(null);

    /**
     * アラートを表示
     * @param {string} message 
     * @param {'info' | 'error' | 'success'} type 
     * @returns {Promise<void>}
     */
    const showAlert = useCallback((message, type = 'info') => {
        return new Promise((resolve) => {
            setAlert({ message, type, resolve });
        });
    }, []);

    /**
     * 確認ダイアログを表示
     * @param {string} message 
     * @returns {Promise<boolean>}
     */
    const showConfirm = useCallback((message) => {
        return new Promise((resolve) => {
            setConfirm({ message, resolve });
        });
    }, []);

    useEffect(() => {
        const handleGlobalAlert = (e) => {
            const { message, type } = e.detail;
            showAlert(message, type);
        };
        window.addEventListener('app-show-alert', handleGlobalAlert);
        return () => window.removeEventListener('app-show-alert', handleGlobalAlert);
    }, [showAlert]);

    const closeAlert = useCallback(() => {
        if (alert?.resolve) alert.resolve();
        setAlert(null);
    }, [alert]);

    const handleConfirm = useCallback((result) => {
        if (confirm?.resolve) confirm.resolve(result);
        setConfirm(null);
    }, [confirm]);

    return (
        <NotificationContext.Provider value={{ showAlert, showConfirm }}>
            {children}
            {/* ポップアップ描画用コンポーネントはここか、App.jsxのトップレベルで配置 */}
            <NotificationOverlay
                alert={alert}
                confirm={confirm}
                onCloseAlert={closeAlert}
                onConfirm={handleConfirm}
            />
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

// UIコンポーネント
import { Info, AlertCircle, CheckCircle2, HelpCircle, X } from 'lucide-react';
import { cn } from '../lib/utils'; // cnヘルパーがあるか確認が必要

const NotificationOverlay = ({ alert, confirm, onCloseAlert, onConfirm }) => {
    if (!alert && !confirm) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Alert View */}
                {alert && (
                    <div className="p-6">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className={cn(
                                "p-3 rounded-full",
                                alert.type === 'error' ? "bg-red-500/20 text-red-400" :
                                    alert.type === 'success' ? "bg-emerald-500/20 text-emerald-400" :
                                        "bg-blue-500/20 text-blue-400"
                            )}>
                                {alert.type === 'error' ? <AlertCircle size={32} /> :
                                    alert.type === 'success' ? <CheckCircle2 size={32} /> :
                                        <Info size={32} />}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white mb-2">
                                    {alert.type === 'error' ? 'エラー' :
                                        alert.type === 'success' ? '完了' : 'お知らせ'}
                                </h3>
                                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                    {alert.message}
                                </p>
                            </div>
                            <button
                                onClick={onCloseAlert}
                                className="w-full py-3 bg-white text-slate-900 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all active:scale-95"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                )}

                {/* Confirm View */}
                {confirm && (
                    <div className="p-6">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-full">
                                <HelpCircle size={32} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white mb-2">確認</h3>
                                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                    {confirm.message}
                                </p>
                            </div>
                            <div className="flex gap-3 w-full mt-2">
                                <button
                                    onClick={() => onConfirm(false)}
                                    className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-all active:scale-95 border border-white/5"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={() => onConfirm(true)}
                                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-500 transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
                                >
                                    実行
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
