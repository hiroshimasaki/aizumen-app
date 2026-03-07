import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle2, ShieldCheck, UserCog } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';

/**
 * パスワードリセット要求画面
 * メールアドレスを入力してリセットリンクを送信する
 */
export default function ForgotPasswordPage() {
    const { resetPassword } = useAuth();
    const { showAlert } = useNotification();
    const [searchParams] = useSearchParams();
    
    // platfromログイン画面から来た場合はデザインをSU寄り（ダーク）にする
    const isPlatform = searchParams.get('type') === 'platform';

    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await resetPassword(email);
            setSent(true);
        } catch (err) {
            const msg = err.response?.data?.error || 'メール送信に失敗しました。';
            showAlert(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`min-h-screen flex items-center justify-center p-6 relative overflow-hidden font-sans ${isPlatform ? 'bg-slate-950 text-slate-200' : 'bg-[#0B1120] text-slate-200'}`}>
            {/* Background Effects */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-600/10 blur-[120px]" />

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-10">
                    <div className={`inline-flex items-center justify-center w-20 h-20 rounded-3xl border border-white/5 mb-6 shadow-2xl ${isPlatform ? 'bg-slate-900' : 'bg-white/10 backdrop-blur-xl'}`}>
                        {isPlatform ? <ShieldCheck className="text-blue-400" size={40} /> : <UserCog className="text-cyan-400" size={40} />}
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">Reset Password</h1>
                    <p className="text-slate-400 text-sm">
                        {isPlatform ? 'サービス管理者専用' : '管理者・ユーザー用'}
                        のパスワード再設定
                    </p>
                </div>

                <div className={`backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 shadow-3xl ${isPlatform ? 'bg-slate-900/50' : 'bg-white/5'}`}>
                    {!sent ? (
                        <>
                            <p className="text-sm text-slate-400 mb-8 text-center leading-relaxed">
                                ご登録済みのメールアドレスを入力してください。<br />
                                パスワード再設定用のリンクをお送りします。
                            </p>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                                        <input
                                            type="email"
                                            required
                                            className="w-full bg-slate-800/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                                            placeholder="admin@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-white text-slate-950 font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 shadow-xl shadow-white/5 mt-4"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : '再設定リンクを送信'}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="text-center py-4 animate-in fade-in zoom-in-95 duration-500">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 className="text-emerald-400" size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-4">メールを送信しました</h2>
                            <p className="text-sm text-slate-400 leading-relaxed mb-8">
                                <strong>{email}</strong> 宛に再設定リンクをお送りしました。<br />
                                メールの内容に従って、新しいパスワードを設定してください。
                            </p>
                        </div>
                    )}

                    <div className="mt-8 pt-8 border-t border-white/5">
                        <Link
                            to={isPlatform ? '/platform-login' : '/login'}
                            className="flex items-center justify-center gap-2 text-slate-500 hover:text-white transition-colors text-sm font-bold"
                        >
                            <ArrowLeft size={16} />
                            ログイン画面に戻る
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
