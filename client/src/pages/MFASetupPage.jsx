import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Loader2, Smartphone, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Super Admin (SU) の MFA 初回設定画面
 */
export default function MFASetupPage() {
    const navigate = useNavigate();
    const { userRole, loading: authLoading } = useAuth();
    const [qrCode, setQrCode] = useState('');
    const [secret, setSecret] = useState('');
    const [factorId, setFactorId] = useState('');
    const [verifyCode, setVerifyCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [settingUp, setSettingUp] = useState(true);
    const [error, setError] = useState(null);

    const setupStarted = useRef(false);

    useEffect(() => {
        if (authLoading) return;
        if (userRole !== 'super_admin') {
            navigate('/', { replace: true });
            return;
        }
        if (setupStarted.current) return;
        setupStarted.current = true;
        setupMFA();
    }, [userRole, authLoading, navigate]);

    const setupMFA = async () => {
        try {
            // 既に未検証の TOTP 要素があれば再利用する
            const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
            if (listError) throw listError;

            const existingUnverified = factors.all.find(f => f.factor_type === 'totp' && f.status === 'unverified');

            if (existingUnverified) {
                console.log('[MFA Setup] Reusing existing unverified factor:', existingUnverified.id);
                // 既存の要素を削除して新しく作り直す（QRコードの有効期限等のため）
                await supabase.auth.mfa.unenroll({ factorId: existingUnverified.id });
            }

            // 新しく要素を作成
            const { data, error } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
                issuer: 'AiZumen Platform',
                friendlyName: 'Platform SU'
            });

            if (error) {
                console.error('[MFA Setup] Enrollment error details:', error);
                throw error;
            }

            setFactorId(data.id);
            setQrCode(data.totp.qr_code);
            setSecret(data.totp.secret);
        } catch (err) {
            console.error('[MFA Setup] Unexpected error:', err);
            setError(err.message || 'MFA設定の開始に失敗しました。プロジェクトの設定でMFAが有効になっているか確認してください助');
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.mfa.challengeAndVerify({
                factorId,
                code: verifyCode,
            });

            if (error) throw error;

            setSettingUp(false);
            // 数秒後にダッシュボードへ
            setTimeout(() => {
                navigate('/super-admin');
            }, 3000);
        } catch (err) {
            setError('認証コードが正しくありません。再度お試しください助');
        } finally {
            setLoading(false);
        }
    };

    if (error && settingUp) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
            <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-3xl text-center">
                <AlertCircle className="text-red-400 mx-auto mb-4" size={48} />
                <h2 className="text-xl font-bold text-white mb-2">MFA 設定エラー</h2>
                <p className="text-slate-400">{error}</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
            <div className="w-full max-w-xl bg-slate-900/50 backdrop-blur-2xl border border-white/5 rounded-[3rem] p-12 shadow-3xl text-center">
                {settingUp ? (
                    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                        <div>
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-6">
                                <Smartphone size={32} />
                            </div>
                            <h1 className="text-3xl font-black text-white tracking-tight">MFA 設定</h1>
                            <p className="text-slate-400 mt-2">セキュリティを保護するため、2段階認証を設定してください助</p>
                        </div>

                        <div className="flex flex-col md:flex-row items-center gap-10 bg-slate-800/30 p-8 rounded-[2rem] border border-white/5">
                            {/* QR Code */}
                            <div className="bg-white p-4 rounded-2xl shadow-2xl">
                                {qrCode ? (
                                    <img src={qrCode} alt="MFA QR Code" className="w-40 h-40" />
                                ) : (
                                    <div className="w-40 h-40 flex items-center justify-center bg-slate-100">
                                        <Loader2 className="animate-spin text-slate-400" />
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 text-left space-y-4">
                                <div className="space-y-1">
                                    <h3 className="text-white font-bold text-sm">1. アプリを起動</h3>
                                    <p className="text-xs text-slate-500">Google Authenticator 等の認証アプリを起動してください助</p>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-white font-bold text-sm">2. QR コードをスキャン</h3>
                                    <p className="text-xs text-slate-500">左の QR コードをアプリで読み取ってください助</p>
                                </div>
                                <div className="space-y-2 pt-2">
                                    <h3 className="text-white font-bold text-sm">3. コードを入力</h3>
                                    <form onSubmit={handleVerify} className="flex gap-2">
                                        <input
                                            type="text"
                                            maxLength={6}
                                            required
                                            className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-4 text-white text-lg font-black tracking-widest focus:outline-none focus:border-blue-500/50 transition-all"
                                            placeholder="000000"
                                            value={verifyCode}
                                            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                                        />
                                        <button
                                            type="submit"
                                            disabled={loading || verifyCode.length !== 6}
                                            className="px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all disabled:opacity-50"
                                        >
                                            {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-800/20 p-4 rounded-2xl text-left border border-white/5">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">スキャンできない場合の秘密キー</p>
                            <code className="text-blue-300 text-xs font-mono break-all bg-slate-950/50 block p-2 rounded-lg">{secret}</code>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 py-10 animate-in fade-in zoom-in-95 duration-700">
                        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 animate-bounce">
                            <CheckCircle2 size={48} />
                        </div>
                        <h2 className="text-3xl font-black text-white">設定完了</h2>
                        <p className="text-slate-400">セキュリティ設定が正常に完了しました。ダッシュボードへ移動します助</p>
                        <div className="pt-4">
                            <button
                                onClick={() => navigate('/super-admin')}
                                className="inline-flex items-center gap-2 text-blue-400 font-bold hover:text-blue-300 transition-colors"
                            >
                                今すぐ移動
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

