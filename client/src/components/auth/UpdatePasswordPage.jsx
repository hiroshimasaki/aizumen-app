import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, CheckCircle2, Loader2, KeyRound, AlertCircle } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import api from '../../lib/api';

/**
 * 新パスワード設定画面
 * パスワードリセットメールのリダイレクト先として使用
 */
export default function UpdatePasswordPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { showAlert } = useNotification();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);

    // メールリンクから戻ってきた際のフラグメント（access_token）をチェック
    useEffect(() => {
        // Supabase Auth はリセットリンククリック時に URL の Hash に access_token を乗せる
        // これによってセッションが確立されている状態になる必要がある
        if (!window.location.hash.includes('access_token=') && !window.location.search.includes('type=recovery')) {
            // トークンがない、かつリカバリータイプでない場合は不正アクセス
            // ただし、既にセッションが確立されている場合はパスワード変更として使える
        }
    }, [location]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (password.length < 8) {
            setError('パスワードは 8 文字以上で入力してください');
            return;
        }

        if (password !== confirmPassword) {
            setError('パスワードが一致しません');
            return;
        }

        setLoading(true);
        try {
            await api.put('/api/auth/update-password', { password });
            setSuccess(true);
            
            // 3秒後にログイン画面へ
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err) {
            const msg = err.response?.data?.error || 'パスワードの更新に失敗しました。リンクの有効期限が切れている可能性があります。';
            setError(msg);
            showAlert(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden font-sans">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full"></div>

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-slate-900 border border-white/5 mb-6 shadow-2xl">
                        <KeyRound className="text-blue-400" size={36} />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">New Password</h1>
                    <p className="text-slate-400 text-sm">新しいパスワードを設定してください</p>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-10 shadow-3xl">
                    {success ? (
                        <div className="text-center py-6 animate-in fade-in zoom-in-95">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 className="text-emerald-400" size={32} />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-4">更新完了</h2>
                            <p className="text-sm text-slate-400 leading-relaxed mb-8">
                                パスワードが正常に更新されました。<br />
                                自動的にログイン画面へ戻ります。
                            </p>
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full bg-white text-slate-950 font-black py-4 rounded-2xl hover:bg-white/90 transition-all shadow-xl"
                            >
                                ログイン画面へ
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-shake">
                                    <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                                    <p className="text-sm text-red-200">{error}</p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">New Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                                    <input
                                        type="password"
                                        required
                                        minLength={8}
                                        autoFocus
                                        className="w-full bg-slate-800/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                                        placeholder="新パスワード (8文字以上)"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Confirm Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                                    <input
                                        type="password"
                                        required
                                        className="w-full bg-slate-800/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                                        placeholder="確認用入力"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 shadow-xl shadow-blue-500/20 mt-4"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : 'パスワードを確定'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
