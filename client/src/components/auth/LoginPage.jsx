import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, User, Lock, Mail } from 'lucide-react';
import api from '../../lib/api';

export default function LoginPage() {
    const { signIn, signInWithCode, signOut } = useAuth();
    const { showAlert } = useNotification();
    const navigate = useNavigate();

    // メンテナンスチェック
    useEffect(() => {
        api.get('/api/sys/status').then(res => {
            if (res.data?.maintenance) {
                window.location.href = '/maintenance';
            }
        }).catch(err => console.error('Failed to check sys status', err));
    }, []);

    // Tab state: 'employee' or 'admin'
    const [loginMode, setLoginMode] = useState('employee');

    // form state
    const [companyCode, setCompanyCode] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        let success = false;
        try {
            const data = await (loginMode === 'employee' 
                ? signInWithCode(companyCode, employeeId, password)
                : signIn(email, password));
            
            if (data?.user?.role === 'super_admin') {
                await signOut();
                const suMsg = 'サービス管理者は専用のログイン画面からログインしてください。';
                setError(suMsg);
                await showAlert(suMsg, 'error');
                return;
            }

            success = true;
            navigate('/');
        } catch (err) {
            let msg = err.response?.data?.error || err.message || 'ログインに失敗しました。認証情報を確認してください。';
            if (msg.includes('Invalid credentials') || msg === 'Invalid login credentials' || msg.includes('Invalid email or password')) {
                msg = loginMode === 'employee'
                    ? '会社コード、従業員番号、またはパスワードが間違っています。'
                    : 'メールアドレスまたはパスワードが間違っています。';
            } else if (msg.includes('Account is deactivated')) {
                msg = 'このアカウントは無効化されています。管理者にご連絡ください。';
            } else if (msg.includes('Network Error') || msg.includes('fetch')) {
                msg = '通信エラーが発生しました。インターネット接続を確認してください。';
            }
            setError(msg);
            await showAlert(msg, 'error');
        } finally {
            if (!success) {
                setLoading(false);
            }
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B1120] text-slate-200 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-600/20 blur-[120px]" />

            <div className="w-full max-w-md p-8 relative z-10">
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                            AiZumen
                        </h1>
                        <p className="text-white/60 mt-2 text-sm">AI図面見積管理システム</p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Mode Switcher */}
                    <div className="flex p-1 bg-white/5 rounded-xl mb-6 border border-white/10 relative z-10">
                        <button
                            type="button"
                            onClick={() => { setLoginMode('employee'); setError(''); }}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${loginMode === 'employee'
                                ? 'bg-indigo-500 text-white shadow-lg'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            従業員
                        </button>
                        <button
                            type="button"
                            onClick={() => { setLoginMode('admin'); setError(''); }}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${loginMode === 'admin'
                                ? 'bg-indigo-500 text-white shadow-lg'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            管理者
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {loginMode === 'employee' ? (
                            <>
                                <div>
                                    <label className="block text-white/80 text-sm font-medium mb-1.5 ml-1">会社コード</label>
                                    <div className="relative">
                                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text" value={companyCode} onChange={e => setCompanyCode(e.target.value)} required
                                            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                            placeholder="sample-inc"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-white/80 text-sm font-medium mb-1.5 ml-1">従業員番号</label>
                                    <div className="relative">
                                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text" value={employeeId} onChange={e => setEmployeeId(e.target.value)} required
                                            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                            placeholder="001"
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div>
                                <label className="block text-white/80 text-sm font-medium mb-1.5 ml-1">メールアドレス</label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="email" value={email} onChange={e => setEmail(e.target.value)} required
                                        className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                        placeholder="admin@example.com"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-white/80 text-sm font-medium mb-1.5 ml-1">パスワード</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="password" value={password} onChange={e => setPassword(e.target.value)} required
                                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25"
                        >
                            {loading ? 'ログイン中...' : 'ログイン'}
                        </button>
                    </form>

                    {/* Links */}
                    <div className="mt-6 text-center space-y-2">
                        {loginMode === 'admin' ? (
                            <Link to="/reset-password" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
                                パスワードをお忘れですか？
                            </Link>
                        ) : (
                            <div className="text-white/40 text-xs px-4 leading-relaxed">
                                パスワードを忘れた場合は、<br />
                                貴社のシステム管理者へ再設定を依頼してください。
                            </div>
                        )}
                        <div className="text-white/40 text-sm pt-2">
                            アカウントをお持ちでない方は{' '}
                            <Link to="/signup" className="text-blue-400 hover:text-blue-300 transition-colors">
                                新規登録
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
