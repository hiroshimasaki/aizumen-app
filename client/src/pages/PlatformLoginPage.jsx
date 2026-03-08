import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, Loader2, ArrowRight, AlertCircle, Smartphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { supabase } from '../lib/supabase';

/**
 * Super Admin (SU) 専用ログインページ
 * 一般ログインとは完全に独立。MFA 認証フローを含む。
 */
export default function PlatformLoginPage() {
    const navigate = useNavigate();
    const { signIn, fetchProfile } = useAuth();
    const { showAlert } = useNotification();

    const [step, setStep] = useState('login'); // 'login' | 'mfa'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mfaCode, setMfaCode] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // 一次認証 (ID/PW)
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        let success = false;
        setError(null);

        try {
            // signIn() は API レスポンスの data をそのまま返す（{ user, session } 形式）
            const signInData = await signIn(email, password);

            // Supabaseでは role は通常 authenticated になるため、app_metadata の role を優先
            const userRole = signInData?.user?.app_metadata?.role || signInData?.user?.role;
            console.log('[PlatformLogin] signIn response:', { userRole, userId: signInData?.user?.id });

            if (userRole !== 'super_admin') {
                // 権限がない場合は即座にサインアウトしてエラーを投げる
                await supabase.auth.signOut();
                throw new Error('このページにアクセスする権限がありません');
            }

            // MFA が必要かチェック
            const { data: mfaData, error: fError } = await supabase.auth.mfa.listFactors();
            if (fError) throw fError;

            const factors = mfaData.all || [];
            const verifiedFactors = factors.filter(f => f.status === 'verified');

            if (verifiedFactors.length === 0) {
                // MFA 未設定の場合は設定画面へ
                navigate('/platform-setup-mfa');
            } else {
                // MFA コード入力ステップへ
                setStep('mfa');
                setLoading(false); // MFAステップではボタンを有効にする
            }
            success = true;
        } catch (err) {
            const msg = err.message === 'Invalid login credentials' ? 'ログイン情報が正しくありません' : err.message;
            setError(msg);
            await showAlert(msg, 'error');
        } finally {
            if (!success) {
                setLoading(false);
            }
        }
    };

    // 二次認証 (MFA Code)
    const handleMfaVerify = async (e) => {
        e.preventDefault();
        setLoading(true);
        let success = false;
        setError(null);

        try {
            const { data: factors } = await supabase.auth.mfa.listFactors();
            const factorId = factors?.all[0]?.id; // 最初の検証済み要素を使用
            
            if (!factorId) throw new Error('MFA要素が見つかりません');

            const { error } = await supabase.auth.mfa.challengeAndVerify({
                factorId,
                code: mfaCode,
            });

            if (error) throw error;

            // 認証成功 -> プロフィールを最新化してから管理画面へ
            await fetchProfile();
            success = true;
            navigate('/super-admin');
        } catch (err) {
            console.error('[PlatformLogin] MFA Verify Error:', err);
            const msg = '認証コードが正しくありません';
            setError(msg);
            await showAlert(msg, 'error');
        } finally {
            if (!success) {
                setLoading(false);
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full"></div>
            </div>

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-slate-900 border border-white/5 mb-6 shadow-2xl">
                        <ShieldCheck className="text-blue-400" size={40} />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">Platform Management</h1>
                    <p className="text-slate-400 text-sm">サービス管理者専用ログインです。一般ユーザーの方はご利用いただけません</p>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-10 shadow-3xl">
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                            <p className="text-sm text-red-200">{error}</p>
                        </div>
                    )}

                    {step === 'login' ? (
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Admin Email</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                                    <input
                                        type="email"
                                        required
                                        className="w-full bg-slate-800/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                                        placeholder="admin@aizumen.internal"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                                    <input
                                        type="password"
                                        required
                                        className="w-full bg-slate-800/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                                <div className="text-right mt-1.5">
                                    <Link 
                                        to="/reset-password?type=platform" 
                                        className="text-xs font-bold text-slate-500 hover:text-blue-400 transition-colors"
                                    >
                                        パスワードをお忘れですか？
                                    </Link>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-white text-slate-950 font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 shadow-xl shadow-white/5 mt-4"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : (
                                    <>
                                        次へ
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleMfaVerify} className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="text-center space-y-3">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                                    <Smartphone size={32} />
                                </div>
                                <h2 className="text-xl font-bold text-white uppercase tracking-tight">2-Factor Authentication</h2>
                                <p className="text-sm text-slate-400">認証アプリに表示されている 6 桁のコードを入力してください</p>
                            </div>

                            <div className="relative group">
                                <input
                                    type="text"
                                    required
                                    maxLength={6}
                                    autoFocus
                                    className="w-full bg-slate-800/50 border border-white/5 rounded-2xl py-5 text-center text-3xl font-black tracking-[0.75em] pl-[0.75em] text-white focus:outline-none focus:border-blue-500/50 focus:ring-8 focus:ring-blue-500/5 transition-all outline-none"
                                    placeholder="000000"
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || mfaCode.length !== 6}
                                className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 shadow-xl shadow-blue-500/20"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : (
                                    <>
                                        本人確認を完了
                                        <ShieldCheck size={18} />
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setStep('login')}
                                className="w-full text-slate-500 text-sm font-bold hover:text-slate-300 transition-colors"
                            >
                                パスワード入力に戻る
                            </button>
                        </form>
                    )}
                </div>

                <div className="mt-6 text-center">
                    <Link to="/login" className="text-slate-600 hover:text-slate-400 text-sm transition-colors flex items-center justify-center gap-1.5">
                        一般ユーザー・テナント管理用ログインへ
                    </Link>
                </div>

                <p className="text-center mt-8 text-xs text-slate-600 font-medium uppercase tracking-widest">
                    &copy; {new Date().getFullYear()} AiZumen Security Infrastructure
                </p>
            </div>
        </div>
    );
}

