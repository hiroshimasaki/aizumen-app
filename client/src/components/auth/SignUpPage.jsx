import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Check, AlertCircle, Building2, User, Mail, Lock, Zap, CheckCircle2, Sparkles } from 'lucide-react';
import api from '../../lib/api';

export default function SignUpPage() {
    const { signUp } = useAuth();
    const navigate = useNavigate();

    // メンテナンスチェック
    useEffect(() => {
        api.get('/api/sys/status').then(res => {
            if (res.data?.maintenance) {
                window.location.href = '/maintenance';
            }
        }).catch(err => console.error('Failed to check sys status', err));
    }, []);

    const [form, setForm] = useState({
        companyName: '',
        companyCode: '',
        userName: '',
        email: '',
        password: '',
        confirmPassword: '',
        plan: 'free', // Default to free trial
    });

    // Field-level errors
    const [formErrors, setFormErrors] = useState({});
    const [globalError, setGlobalError] = useState('');
    const [loading, setLoading] = useState(false);

    function handleChange(e) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
        // Clear specific field error when user types
        if (formErrors[e.target.name]) {
            setFormErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[e.target.name];
                return newErrors;
            });
        }
    }

    function validateForm() {
        const errors = {};
        if (!form.companyName.trim()) errors.companyName = '会社名を入力してください';
        if (!form.companyCode.trim()) {
            errors.companyCode = '会社コードを入力してください';
        } else if (!/^[a-zA-Z0-9\-]+$/.test(form.companyCode)) {
            errors.companyCode = '会社コードは半角英数字とハイフンのみ使用可能です';
        }
        if (!form.userName.trim()) errors.userName = '担当者名を入力してください';
        if (!form.email.trim()) {
            errors.email = 'メールアドレスを入力してください';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            errors.email = '有効なメールアドレスを入力してください';
        }

        if (form.password.length < 8) {
            errors.password = 'パスワードは8文字以上で設定してください';
        }
        if (form.password !== form.confirmPassword) {
            errors.confirmPassword = 'パスワードが一致しません';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setGlobalError('');

        if (!validateForm()) return;

        setLoading(true);
        try {
            const result = await signUp({
                email: form.email,
                password: form.password,
                userName: form.userName,
                companyName: form.companyName,
                companyCode: form.companyCode,
                plan: form.plan,
            });

            // 有料プランの場合は決済画面へリダイレクト
            if (result.checkoutUrl) {
                window.location.href = result.checkoutUrl;
            } else {
                navigate('/quotations');
            }
        } catch (err) {
            console.error(err);
            setGlobalError(err.response?.data?.error || err.message || 'アカウント作成に失敗しました。時間をおいて再試行してください。');
        } finally {
            setLoading(false);
        }
    }

    // Plans data matching server side Stripe config
    const plans = [
        {
            value: 'free',
            label: '7日間 無料体験',
            desc: '全機能を無料でお試し',
            price: '¥0',
            users: '1名',
            ai: '10回',
            popular: true
        },
        {
            value: 'lite',
            label: 'Lite',
            desc: '少人数向け',
            price: '¥10,000 / 月 (税込)',
            users: '2名まで',
            ai: '毎月100回'
        },
        {
            value: 'plus',
            label: 'Plus',
            desc: '標準的なチーム向け',
            price: '¥30,000 / 月 (税込)',
            users: '10名まで',
            ai: '毎月500回'
        },
        {
            value: 'pro',
            label: 'Pro',
            desc: '大容量・多人数向け',
            price: '¥50,000 / 月 (税込)',
            users: '20名まで',
            ai: '毎月1,000回'
        },
    ];

    const getInputClassName = (errorKey) => `
        w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border text-white placeholder-white/30 
        focus:outline-none focus:ring-2 transition-all
        ${formErrors[errorKey] ? 'border-red-500/50 focus:ring-red-500/50 bg-red-500/5' : 'border-white/10 focus:ring-blue-500/50 hover:bg-white/10'}
    `;

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B1120] text-slate-200 py-12 px-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-600/20 blur-[120px]" />

            <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 lg:gap-12 relative z-10">
                {/* Left Side: Plan Selection & Info */}
                <div className="space-y-6 flex flex-col justify-center">
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Zap className="w-6 h-6 text-cyan-400" />
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                                AiZumen
                            </h1>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">注文の解析と図面管理を、AIで加速。</h2>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6">
                            面倒な注文書の入力作業をAIが自動化し、図面データと紐づけて一元管理。事務作業を削減し、現場のペーパーレス化を強力に後押しします。まずは無料体験からはじめてみませんか？
                        </p>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-300">初期プランを選択 (登録後に変更可能)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {plans.map(plan => (
                                <button
                                    key={plan.value}
                                    type="button"
                                    onClick={() => setForm(prev => ({ ...prev, plan: plan.value }))}
                                    className={`relative p-4 rounded-xl border text-left transition-all overflow-hidden ${form.plan === plan.value
                                        ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/50'
                                        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                                        }`}
                                >
                                    {plan.popular && (
                                        <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">
                                            おすすめ
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`font-bold ${form.plan === plan.value ? 'text-cyan-400' : 'text-slate-200'}`}>
                                            {plan.label}
                                        </span>
                                        {form.plan === plan.value && <Check className="w-4 h-4 text-cyan-400" />}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mb-2">{plan.desc}</div>
                                    <div className="text-sm font-bold text-white mb-3">{plan.price}</div>

                                    <div className="space-y-1.5 pt-3 border-t border-white/10">
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="text-slate-500">アカウント数</span>
                                            <span className="text-slate-300 font-medium">{plan.users}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="text-slate-500">AI解析</span>
                                            <span className="text-slate-300 font-medium flex items-center gap-1">
                                                {plan.ai}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-center mt-2">
                                            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold whitespace-nowrap flex items-center gap-1">
                                                <Sparkles className="w-3 h-3" /> 初回特典 +10クレジット
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Side: Signup Form */}
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 sm:p-8 shadow-2xl relative">
                    <div className="mb-6">
                        {/* Bonus Banner */}
                        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border border-amber-500/30 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                            <div className="flex items-center gap-3 relative z-10">
                                <div className="p-2 bg-amber-500 rounded-lg shadow-lg shadow-amber-500/20 animate-pulse">
                                    <Sparkles className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-0.5">Limited Bonus</div>
                                    <div className="text-sm font-bold text-white leading-tight">
                                        新規登録で <span className="text-amber-400 text-lg mx-0.5">10</span> クレジット進呈中！
                                    </div>
                                </div>
                            </div>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-1">アカウント作成</h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            クレジットカード登録は不要です
                        </p>
                    </div>

                    {globalError && (
                        <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3 text-red-200 text-sm animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                            <p>{globalError}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                        <div>
                            <label className="block text-slate-400 text-xs font-bold mb-1.5 ml-1">会社名</label>
                            <div className="relative">
                                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text" name="companyName" value={form.companyName}
                                    onChange={handleChange}
                                    className={getInputClassName('companyName')}
                                    placeholder="株式会社 サンプル"
                                />
                            </div>
                            {formErrors.companyName && <p className="mt-1.5 ml-1 text-xs text-red-400 font-medium">{formErrors.companyName}</p>}
                        </div>

                        <div>
                            <label className="block text-slate-400 text-xs font-bold mb-1.5 ml-1">会社コード (ログイン用のアカウントIDになります)</label>
                            <div className="relative">
                                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text" name="companyCode" value={form.companyCode}
                                    onChange={handleChange}
                                    className={getInputClassName('companyCode')}
                                    placeholder="sample-inc"
                                />
                            </div>
                            {formErrors.companyCode && <p className="mt-1.5 ml-1 text-xs text-red-400 font-medium">{formErrors.companyCode}</p>}
                        </div>

                        <div>
                            <label className="block text-slate-400 text-xs font-bold mb-1.5 ml-1">ご担当者名</label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text" name="userName" value={form.userName}
                                    onChange={handleChange}
                                    className={getInputClassName('userName')}
                                    placeholder="ご担当者名"
                                />
                            </div>
                            {formErrors.userName && <p className="mt-1.5 ml-1 text-xs text-red-400 font-medium">{formErrors.userName}</p>}
                        </div>

                        <div>
                            <label className="block text-slate-400 text-xs font-bold mb-1.5 ml-1">メールアドレス</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="email" name="email" value={form.email}
                                    onChange={handleChange}
                                    className={getInputClassName('email')}
                                    placeholder="admin@example.com"
                                />
                            </div>
                            {formErrors.email && <p className="mt-1.5 ml-1 text-xs text-red-400 font-medium">{formErrors.email}</p>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-4">
                            <div>
                                <label className="block text-slate-400 text-xs font-bold mb-1.5 ml-1">パスワード</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="password" name="password" value={form.password}
                                        onChange={handleChange}
                                        className={`${getInputClassName('password')} placeholder:text-[11px] sm:placeholder:text-sm`}
                                        placeholder="8文字以上の英数字"
                                    />
                                </div>
                                {formErrors.password && <p className="mt-1.5 ml-1 text-xs text-red-400 font-medium leading-tight">{formErrors.password}</p>}
                            </div>
                            <div>
                                <label className="block text-slate-400 text-xs font-bold mb-1.5 ml-1">パスワード（確認用）</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="password" name="confirmPassword" value={form.confirmPassword}
                                        onChange={handleChange}
                                        className={`${getInputClassName('confirmPassword')} placeholder:text-[11px] sm:placeholder:text-sm`}
                                        placeholder="もう一度入力"
                                    />
                                </div>
                                {formErrors.confirmPassword && <p className="mt-1.5 ml-1 text-xs text-red-400 font-medium leading-tight">{formErrors.confirmPassword}</p>}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    アカウントを作成中...
                                </>
                            ) : (
                                'アカウントを作成して始める'
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-white/10 text-center">
                        <p className="text-slate-400 text-sm">
                            すでにアカウントをお持ちの方は{' '}
                            <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors hover:underline">
                                ログイン
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
