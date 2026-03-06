import { useState, useEffect, useRef } from 'react';
import { CreditCard, Zap, Check, ChevronRight, Package, History, AlertCircle, Calendar, HardDrive } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useNotification } from '../../contexts/NotificationContext';

const PLANS = [
    { id: 'lite', name: 'Lite', price: '10,000', users: 2, credits: 100, features: ['2ユーザーまで', '毎月100クレジット付与', 'ストレージ 5GB (約1万枚相当)', 'AI抽出条件カスタム', 'バックアップ7日間保持'] },
    { id: 'plus', name: 'Plus', price: '30,000', users: 10, credits: 500, features: ['10ユーザーまで', '毎月500クレジット付与', 'ストレージ 20GB (約4万枚相当)', 'AI抽出条件カスタム', 'バックアップ7日間保持'] },
    { id: 'pro', name: 'Pro', price: '50,000', users: 20, credits: 1000, features: ['20ユーザーまで', '毎月1,000クレジット付与', 'ストレージ 100GB (約20万枚相当)', 'AI抽出条件カスタム', '高度な分析レポート', 'バックアップ30日間保持'] },
];

const CREDIT_PACKS = [
    { amount: '200', name: '200クレジット', price: '2,000' },
    { amount: '1000', name: '1200クレジット (+200ボーナス)', price: '10,000' },
    { amount: '2000', name: '2500クレジット (+500ボーナス)', price: '20,000' },
];

export default function Billing() {
    const { credits, setCredits, tenant, isFreePlan, isExpired, fetchProfile } = useAuth();
    const { showAlert, showConfirm } = useNotification();
    const navigate = useNavigate();
    const [subscription, setSubscription] = useState(null);
    const [loading, setLoading] = useState(true);
    const [stripeDetails, setStripeDetails] = useState({ paymentMethod: null, pending_plan: null });
    const [loadingStripe, setLoadingStripe] = useState(false);
    const [processing, setProcessing] = useState(null); // 'plan-id' or 'credit-pack-id'
    const verificationStarted = useRef(false);

    useEffect(() => {
        const verifyAndFetch = async () => {
            // Stripe Checkout成功後のリダイレクト検出
            const params = new URLSearchParams(window.location.search);
            const sessionId = params.get('session_id');
            const success = params.get('success');

            if (success === 'true' && sessionId && !verificationStarted.current) {
                verificationStarted.current = true;
                navigate('/admin?tab=billing', { replace: true });

                try {
                    await api.post('/api/subscription/checkout/verify', { sessionId });
                    await fetchProfile();
                } catch (err) {
                    console.error('[Billing] Session verify failed:', err);
                }
            }

            await fetchSubscription();
            fetchStripeDetails();
        };
        verifyAndFetch();
    }, []);

    const fetchSubscription = async () => {
        try {
            const { data } = await api.get('/api/subscription');
            setSubscription(data);
        } catch (err) {
            console.error('Failed to fetch subscription:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStripeDetails = async () => {
        setLoadingStripe(true);
        try {
            const { data } = await api.get('/api/subscription/stripe-details');
            setStripeDetails(data);
        } catch (err) {
            console.error('Failed to fetch stripe details:', err);
        } finally {
            setLoadingStripe(false);
        }
    };

    const handleCancelDowngrade = async () => {
        if (!await showConfirm('ダウングレードの予約を取り消し、現在のプランを継続しますか？')) return;

        setProcessing('cancel-downgrade');
        try {
            await api.post('/api/subscription/cancel-downgrade');
            await fetchSubscription();
            await fetchStripeDetails();
            await showAlert('ダウングレードの予約を取り消しました。', 'success');
        } catch (err) {
            console.error('Failed to cancel downgrade:', err);
            await showAlert('予約のキャンセルに失敗しました。', 'error');
        } finally {
            setProcessing(null);
        }
    };

    const handlePlanCheckout = async (planId) => {
        const targetPlan = PLANS.find(p => p.id === planId);
        const currentPlan = PLANS.find(p => p.id === currentPlanId);

        let confirmMsg = `${targetPlan.name} プランに変更しますか？`;
        if (targetPlan && currentPlan) {
            if (PLANS.indexOf(targetPlan) < PLANS.indexOf(currentPlan)) {
                confirmMsg = `${targetPlan.name} プランへのダウングレードを予約しますか？\n（変更は次回更新時に適用されます）`;
            } else {
                confirmMsg = `${targetPlan.name} プランへアップグレードしますか？\n（即時適用され、今月分は日割りで精算されます）`;
            }
        }

        if (!await showConfirm(confirmMsg)) return;

        setProcessing(planId);
        try {
            const { data } = await api.post('/api/subscription/checkout', { plan: planId });
            if (data.scheduled) {
                await fetchProfile();
                await fetchSubscription();
                await fetchStripeDetails();
                await showAlert(`次回更新時(${new Date(subscription?.subscription?.current_period_end).toLocaleDateString()})に ${data.plan} プランへ変更されます。`, 'success');
                setProcessing(null);
            } else if (data.updated) {
                await fetchProfile();
                await fetchSubscription();
                await fetchStripeDetails();
                await showAlert(`プランを ${data.plan} に変更しました。`, 'success');
                setProcessing(null);
            } else {
                window.location.href = data.url;
            }
        } catch (err) {
            console.error('Checkout failed:', err);
            await showAlert(err.response?.data?.message || 'プラン変更に失敗しました。', 'error');
            setProcessing(null);
        }
    };

    const handleCreditPurchase = async (packId, useStoredCard = false) => {
        const pack = CREDIT_PACKS.find(p => p.amount === packId);
        const pm = stripeDetails?.paymentMethod || subscription?.paymentMethod;

        if (useStoredCard && pm) {
            const { brand, last4 } = pm;
            const confirmMsg = `登録済みのカード (${brand.toUpperCase()} ****${last4}) に ¥${pack.price} を請求し、${pack.name} を追加します。よろしいですか？\n\n※領収書は登録メールアドレスに自動送付されます。`;
            if (!await showConfirm(confirmMsg)) return;
        }

        setProcessing(`credit-${packId}`);
        try {
            const { data } = await api.post('/api/subscription/credits/purchase', {
                creditAmount: packId,
                useStoredCard
            });

            if (data.success) {
                await fetchProfile();
                await fetchSubscription();
                await fetchStripeDetails();
                await showAlert(`${data.balanceIncrement}Pt を追加しました。`, 'success');
            } else if (data.url) {
                window.location.href = data.url;
            }
        } catch (err) {
            console.error('Credit purchase failed:', err);
            await showAlert(err.response?.data?.message || '購入処理に失敗しました。', 'error');
        } finally {
            setProcessing(null);
        }
    };

    const handlePortal = async () => {
        setProcessing('portal');
        try {
            const { data } = await api.post('/api/subscription/portal');
            window.location.href = data.url;
        } catch (err) {
            console.error('Portal failed:', err);
            await showAlert('カスタマーポータルの起動に失敗しました。サブスクリプションが有効でない可能性があります。', 'error');
        } finally {
            setProcessing(null);
        }
    };

    if (loading) return (
        <div className="text-slate-400">
            読み込み中...
        </div>
    );

    const currentPlanId = tenant?.plan || 'lite';
    const showTrialExpiredWarning = isFreePlan && isExpired;

    return (
        <div className="space-y-8">
            {isExpired && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-red-500/20 rounded-full">
                            <AlertCircle className="w-6 h-6 text-red-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white mb-2">{isFreePlan ? '無料トライアル期間が終了しました' : 'サブスクリプション有効期限が終了しました'}</h3>
                            <p className="text-red-200 text-sm leading-relaxed mb-4">
                                {isFreePlan
                                    ? 'アカウントの全機能（案件の閲覧・作成を含む）が一時的に制限されています。引き続き AiZumen をご利用いただくには、以下のいずれかの有料プランを選択してサブスクリプションを開始してください。'
                                    : 'サブスクリプションの有効期限が切れたため、機能が制限されています。引き続きご利用いただくには、お支払い情報の更新または再契約を行ってください。'
                                }
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* 現在の状況 */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 backdrop-blur-md">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">現在のプラン</p>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                            <Package className="text-indigo-400" size={24} />
                        </div>
                        <div>
                            <h4 className="text-xl font-bold text-white capitalize">{currentPlanId} プラン</h4>
                            <div className="min-h-[32px] flex flex-col justify-center"> {/* レイアウトシフトを防止するための高さ確保 */}
                                {(stripeDetails?.pending_plan || subscription?.subscription?.pending_plan) ? (
                                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
                                        <p className="text-sm font-medium text-amber-500 animate-pulse">
                                            次回更新時に {stripeDetails?.pending_plan || subscription?.subscription?.pending_plan} へ変更予定
                                        </p>
                                        <button
                                            onClick={handleCancelDowngrade}
                                            disabled={!!processing}
                                            className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded hover:bg-amber-500 hover:text-white transition-all"
                                        >
                                            予約をキャンセル
                                        </button>
                                    </div>
                                ) : loadingStripe ? (
                                    <div className="w-48 h-3 bg-amber-500/10 rounded animate-pulse" />
                                ) : null}
                            </div>
                            <p className="text-xs text-slate-400 whitespace-nowrap mt-1">
                                {subscription?.subscription?.status === 'active' ? 'サブスクリプション有効' : '無料トライアル / 制限中'}
                            </p>
                        </div>
                    </div>
                    {subscription?.subscription?.current_period_end && subscription?.subscription?.status === 'active' && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center gap-2">
                            {(() => {
                                // Stripeの詳細情報が読み込まれている場合はそれを優先、そうでなければDBの値を参照
                                const isExpiring = !loadingStripe
                                    ? stripeDetails?.cancel_at_period_end
                                    : subscription?.subscription?.cancel_at_period_end;

                                return (
                                    <>
                                        <Calendar size={14} className={isExpiring ? 'text-red-400' : 'text-slate-400'} />
                                        <span className={`text-xs ${isExpiring ? 'text-red-400' : 'text-slate-400'}`}>
                                            {isExpiring
                                                ? `${new Date(subscription.subscription.current_period_end).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })} で終了予定`
                                                : `次回更新: ${new Date(subscription.subscription.current_period_end).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}`
                                            }
                                        </span>
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>

                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 backdrop-blur-md">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">AIクレジット残高</p>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 rounded-lg">
                            <Zap className="text-amber-400" size={24} />
                        </div>
                        <div>
                            <h4 className="text-xl font-bold text-white">{credits?.balance || 0} Pt</h4>
                            {!isFreePlan && (
                                <p className="text-xs text-slate-400">今月の付与量: {credits?.monthly_quota || 0} Pt</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 backdrop-blur-md">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">ストレージ使用量</p>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                            <HardDrive className="text-emerald-400" size={24} />
                        </div>
                        <div className="w-full">
                            {(() => {
                                const usageGB = (subscription?.plan?.storageUsage || 0) / (1024 * 1024 * 1024);
                                const maxGB = subscription?.plan?.maxStorageGB || 1;
                                const percent = Math.min((usageGB / maxGB) * 100, 100);
                                return (
                                    <>
                                        <div className="flex items-end justify-between mb-1">
                                            <h4 className="text-xl font-bold text-white">{usageGB.toFixed(1)} GB</h4>
                                            <span className="text-xs text-slate-400">/ {maxGB} GB</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${percent >= 80 ? 'bg-red-500' : 'bg-emerald-400'}`}
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                        <div className="text-right mt-1">
                                            <span className={`text-[10px] font-medium ${percent >= 80 ? 'text-red-400' : 'text-slate-500'}`}>
                                                {Math.floor(percent)}% 使用
                                            </span>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 backdrop-blur-md">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">支払い管理</p>
                        <button
                            onClick={handlePortal}
                            disabled={!!processing}
                            className={cn(
                                "w-full flex items-center justify-between px-4 py-3 bg-slate-900/50 hover:bg-slate-900 border border-slate-700 rounded-xl text-sm font-medium text-slate-300 transition-all",
                                processing === 'portal' && "opacity-50"
                            )}
                        >
                            <div className="flex flex-col items-start gap-0.5">
                                <div className="flex items-center gap-2">
                                    <CreditCard size={18} className="shrink-0" />
                                    <span className="text-sm font-medium whitespace-nowrap">
                                        {processing === 'portal' ? '処理中...' : '支払い情報の管理'}
                                    </span>
                                </div>
                                {/* カード情報の表示エリアを固定高にしてガタつきを防止 */}
                                <div className="h-4 flex items-center">
                                    {(stripeDetails?.paymentMethod || subscription?.paymentMethod) ? (
                                        <span className="text-[10px] text-slate-400 pl-6.5 font-mono animate-in fade-in duration-300">
                                            {(stripeDetails?.paymentMethod || subscription?.paymentMethod).brand.toUpperCase()} ****{(stripeDetails?.paymentMethod || subscription?.paymentMethod).last4}
                                        </span>
                                    ) : loadingStripe ? (
                                        <div className="ml-6.5 w-24 h-2 bg-slate-700/50 rounded animate-pulse" />
                                    ) : (
                                        <span className="text-[10px] text-slate-500 pl-6.5 italic">
                                            カード情報未設定
                                        </span>
                                    )}
                                </div>
                            </div>
                            <ChevronRight size={16} className="text-slate-500 shrink-0" />
                        </button>
                    </div>
                </div>
            </div>

            {/* プラン選択 */}
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Package className="text-cyan-400" size={24} />
                    プランの変更
                </h3>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-xs text-slate-400 space-y-1">
                    <p><strong className="text-slate-300">※ プラン変更の適用タイミングについて：</strong></p>
                    <ul className="list-disc list-inside pl-1 space-y-0.5">
                        <li><strong>アップグレードの場合：</strong> 即時適用されます（直近の請求は日割り計算となります）。</li>
                        <li><strong>ダウングレードの場合：</strong> 次回更新時に変更が適用されます。</li>
                    </ul>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {PLANS.map((p) => (
                        <div
                            key={p.id}
                            className={cn(
                                "relative p-6 rounded-2xl border transition-all duration-300",
                                currentPlanId === p.id
                                    ? "bg-indigo-600/10 border-indigo-500 shadow-lg shadow-indigo-500/10"
                                    : "bg-slate-800/30 border-slate-700 hover:border-slate-500"
                            )}
                        >
                            {currentPlanId === p.id && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
                                    現在のプラン
                                </div>
                            )}
                            <div className="mb-4">
                                <h4 className="text-lg font-bold text-white mb-1">{p.name}</h4>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-white">¥{p.price}</span>
                                    <span className="text-xs text-slate-500">/ 月 (税別)</span>
                                </div>
                            </div>
                            <ul className="space-y-3 mb-6">
                                {p.features.map((f, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                        <Check size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <button
                                onClick={() => handlePlanCheckout(p.id)}
                                disabled={currentPlanId === p.id || !!processing}
                                className={cn(
                                    "w-full py-2.5 rounded-xl text-xs font-bold transition-all",
                                    currentPlanId === p.id
                                        ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                                        : "bg-white text-slate-900 hover:bg-indigo-50"
                                )}
                            >
                                {processing === p.id ? '処理中...' : (currentPlanId === p.id ? '現在のプラン' : 'このプランに変更')}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* クレジット購入 */}
            <div className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="max-w-md">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
                            <Zap className="text-amber-400" size={24} />
                            追加AIクレジットの購入
                        </h3>
                        {isFreePlan ? (
                            <p className="text-sm text-amber-400">
                                クレジットの追加購入は有料プランをご契約中の場合にご利用いただけます。上記のプランからお選びください。
                            </p>
                        ) : (
                            <p className="text-sm text-slate-400">
                                月間の付与分を超えて解析を行いたい場合は、必要な分だけクレジットを追加購入できます。購入したクレジットに有効期限はありません。
                            </p>
                        )}
                    </div>
                    {!isFreePlan && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {CREDIT_PACKS.map((pack) => {
                                const pm = stripeDetails?.paymentMethod || subscription?.paymentMethod;
                                return (
                                    <div key={pack.amount} className="flex flex-col gap-3 group/pack">
                                        <button
                                            onClick={() => handleCreditPurchase(pack.amount, !!pm)}
                                            disabled={!!processing}
                                            className="relative flex flex-col items-center justify-center min-h-[110px] bg-slate-900 hover:bg-slate-950 border border-slate-700 hover:border-amber-500/50 p-4 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-amber-500/5 w-full overflow-hidden"
                                        >
                                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover/pack:opacity-30 transition-opacity">
                                                <Zap size={40} className="text-amber-500" />
                                            </div>
                                            <span className="text-xs font-bold text-slate-500 mb-1 relative z-10">{pack.name}</span>
                                            <span className="text-xl font-black text-white mb-2 relative z-10">¥{pack.price}</span>
                                            <div className="text-[10px] font-bold px-4 py-1.5 bg-amber-500/10 text-amber-500 rounded-lg group-hover/pack:bg-amber-500 group-hover/pack:text-white transition-all relative z-10">
                                                {processing === `credit-${pack.amount}` ? '通信中...' : (pm ? '今すぐチャージ' : '購入する')}
                                            </div>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* 注意事項 */}
            <div className="flex items-start gap-3 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl text-xs text-indigo-300">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="font-bold">サブスクリプションについて</p>
                    <ul className="list-disc list-inside space-y-0.5 text-indigo-300/80">
                        <li>アップグレードは即時に適用され、日割りで計算されます。ダウングレードは次回更新時に適用されます。</li>
                        <li>解約はいつでも可能ですが、現在の契約期間終了までは全ての機能をご利用いただけます。</li>
                        <li>AIクレジットは毎月の更新日（契約応当日）にリセットされ、新しくプラン付帯分が付与されます。</li>
                        <li>月間の付与クレジットは次月へ繰り越されませんが、別途購入した追加クレジットに有効期限はありません。</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
