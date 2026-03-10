import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [tenant, setTenant] = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isProfileLoaded, setIsProfileLoaded] = useState(false);
    const [mfaLevel, setMfaLevel] = useState('aal1');

    // 最新の値をリスナーから参照するためのリファレンス
    const userRef = useRef(user);
    const isProfileLoadedRef = useRef(isProfileLoaded);

    useEffect(() => {
        userRef.current = user;
        isProfileLoadedRef.current = isProfileLoaded;
    }, [user, isProfileLoaded]);

    useEffect(() => {
        // パスワードリセット等の公開認証ページではfetchProfileをスキップ
        // （セッション確立前にAPIを叩いて401 → SIGNED_OUT の連鎖を防ぐ）
        const publicAuthPaths = ['/update-password', '/reset-password', '/login', '/signup', '/platform-login'];
        const isPublicAuthPage = publicAuthPaths.includes(window.location.pathname);

        // 初期セッション確認
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setMfaLevel(session?.user?.app_metadata?.aal || 'aal1');
            if (session?.user && !isPublicAuthPage) {
                fetchProfile();
            } else {
                setLoading(false);
            }
        });

        // セッション変更の監視
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                console.log(`[AuthContext] Auth State Change: ${event}`, session?.user?.id);
                setSession(session);
                setMfaLevel(session?.user?.app_metadata?.aal || 'aal1');

                if (session?.user) {
                    // ユーザーIDが同じであれば、既存のプロファイルを消さないように setUser する
                    setUser(prev => {
                        if (prev?.id === session.user.id && prev.profile) {
                            return { ...session.user, profile: prev.profile };
                        }
                        return session.user;
                    });

                    // 公開認証ページではfetchProfileをスキップ
                    if (isPublicAuthPage) return;

                    // 最新の ref を参照して、既にプロフィールがある場合は不必要な fetch を避ける
                    if (!isProfileLoadedRef.current || event === 'SIGNED_IN' || event === 'TOKEN_REFRESH') {
                        fetchProfile();
                    }
                } else {
                    setUser(null);
                    setTenant(null);
                    setSubscription(null);
                    setLoading(false);
                    setIsProfileLoaded(false);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const [credits, setCredits] = useState({ balance: 0, monthly_quota: 0 });

    async function fetchProfile() {
        // プロフィール取得中は loading を true にして不完全な状態でのレンダリングを防ぐ
        // ただし、既にプロファイルがある場合はチラつき防止（画面リセット防止）のため false のままにする
        if (!userRef.current?.profile) setLoading(true);

        const { data: { session } } = await supabase.auth.getSession();
        console.log('[AuthContext] Fetching profile and credits...', {
            userId: session?.user?.id,
            hasAccessToken: !!session?.access_token,
            tokenPrefix: session?.access_token ? session.access_token.substring(0, 10) : 'none'
        });

        try {
            // super_admin の場合はクレジット取得をスキップするか、ダミーをセットする
            const isSU = userRef.current?.app_metadata?.role === 'super_admin';
            
            const [profileRes, creditsRes] = await Promise.all([
                api.get('/api/auth/me'),
                isSU ? Promise.resolve({ data: { balance: 999999, monthly_quota: 0 } }) : 
                      api.get('/api/credits/balance').catch(() => ({ data: { balance: 0, monthly_quota: 0 } }))
            ]);

            const profileData = profileRes.data.user;
            setTenant(profileRes.data.tenant);
            setSubscription(profileRes.data.subscription);
            setCredits(creditsRes.data);

            setUser(prev => {
                if (!prev) return null;
                return { ...prev, profile: profileData };
            });
            setIsProfileLoaded(true);
        } catch (err) {
            console.error('プロフィールの取得に失敗しました:', err);
            const msg = err.response?.data?.error || 'プロフィールの取得に失敗しました。';
            // 401 の場合は自動ログアウト処理に任せる
            if (err.response?.status !== 401) {
                // api.js の interceptor での signOut より先に実行される可能性があるため注意
                // ここでは単にログのみに留めるか、別の手段で通知
            }
        } finally {
            setLoading(false);
        }
    }

    async function signIn(email, password) {
        // 直接 Supabase を叩かず、サーバー経由でログインすることで
        // 多重ログイン制御用のセッションIDをDBに登録させる
        const { data } = await api.post('/api/auth/login', {
            email,
            password,
            clientType: 'web'
        });

        if (data.session) {
            await supabase.auth.setSession({
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
            });
            // ページ遷移前にプロファイルを読み込むことで表示不整合を防ぐ
            await fetchProfile();
        }
        return data;
    }

    async function signInWithCode(companyCode, employeeId, password) {
        const { data } = await api.post('/api/auth/login-with-code', {
            companyCode, employeeId, password,
            clientType: 'web'
        });
        if (data.session) {
            await supabase.auth.setSession({
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
            });
            // ページ遷移前にプロファイルを読み込むことで表示不整合を防ぐ
            await fetchProfile();
        }
        return data;
    }

    async function signUp({ email, password, userName, companyName, companyCode, plan }) {
        const { data } = await api.post('/api/auth/signup', {
            email, password, userName, companyName, companyCode, plan,
        });
        // サインアップ後に自動ログイン
        if (data.session) {
            await supabase.auth.setSession({
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
            });
            // ページ遷移前にプロファイルを読み込むことで表示不整合を防ぐ
            await fetchProfile();
        }
        return data;
    }

    async function signOut() {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setTenant(null);
        setSubscription(null);
        setIsProfileLoaded(false);
    }

    async function resetPassword(email) {
        await api.post('/api/auth/reset-password', { email });
    }

    // トライアル状態の計算と定期更新
    const [currentTime, setCurrentTime] = useState(new Date());

    // Date オブジェクトを安定化させる
    const trialEndsAt = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
    const periodEndsAt = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;

    useEffect(() => {
        // 期限情報がある場合のみタイマーを回す
        const hasExpiry = (tenant?.plan === 'free' && tenant?.trial_ends_at) || (subscription?.current_period_end);
        if (!hasExpiry) return;

        console.log('[AuthContext] Starting expiry monitor timer (10s)...');
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 10000); // 10秒ごとに更新してリアルタイム性を高める
        return () => clearInterval(interval);
        // 依存配列にはプリミティブな値を入れることで不必要な再生成を防ぐ
    }, [tenant?.plan, tenant?.trial_ends_at, subscription?.current_period_end]);

    const getExpiryStatus = () => {
        // 1. サブスクリプション情報（本契約履歴）がある場合は最優先でチェック
        if (subscription) {
            // ステータスが canceled, unpaid または incomplete_expired なら期限切れ
            if (['canceled', 'unpaid', 'incomplete_expired'].includes(subscription.status)) {
                return { isExpired: true, label: '終了' };
            }

            // 期限日時を持っている場合、過去なら期限切れ
            if (periodEndsAt) {
                if (periodEndsAt.getTime() <= currentTime.getTime()) {
                    return { isExpired: true, label: '終了' };
                }
            }

            // 本契約が有効（active, trialing 等）で期限内なら、無料トライアルの期限にかかわらず有効
            if (subscription.status === 'active' || subscription.status === 'trialing' || subscription.status === 'past_due') {
                return { isExpired: false, label: '有効' };
            }
        }

        // 2. 本契約履歴がない、または判定を抜けた場合は、無料プラン（トライアル）の期限をチェック
        if (tenant?.plan === 'free') {
            if (!trialEndsAt) return { isExpired: false, label: '' };
            const diffMs = trialEndsAt.getTime() - currentTime.getTime();
            if (diffMs <= 0) return { isExpired: true, label: '終了' };

            const diffMins = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

            if (diffHours >= 24) return { isExpired: false, label: `残り ${diffDays}日` };
            if (diffHours >= 1) return { isExpired: false, label: `残り ${diffHours}時間` };
            return { isExpired: false, label: `残り ${diffMins}分` };
        }

        return { isExpired: false, label: '有効' };
    };

    const { isExpired, label: trialTimeLeft } = getExpiryStatus();

    const isFreePlan = tenant?.plan === 'free';

    // 期限が来た瞬間に一度だけ fetchProfile を実行してサーバーの自己修復結果を反映させる
    const prevIsExpiredRef = useRef(isExpired);
    useEffect(() => {
        if (isExpired && !prevIsExpiredRef.current && isProfileLoaded) {
            console.log('[AuthContext] Expiry detected! Syncing with server...');
            fetchProfile();
        }
        prevIsExpiredRef.current = isExpired;
    }, [isExpired, isProfileLoaded]);

    // プロフィール情報が読み込まれるまでは、JWT（app_metadata）の情報も利用することで
    // リフレッシュ時のロールのチラつきとリダイレクトループ（白画面）を防止する
    const userRole = user?.profile?.role || user?.app_metadata?.role || 'user';
    const isAdmin = userRole === 'admin' || userRole === 'system_admin';

    // AIクレジットのリアルタイム同期
    useEffect(() => {
        if (!tenant?.id) return;

        const channel = supabase.channel(`credits_changes_${tenant.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'ai_credits',
                    filter: `tenant_id=eq.${tenant.id}`
                },
                (payload) => {
                    console.log('[AuthContext] AI Credits updated via realtime', payload.new);
                    setCredits(prev => ({
                        ...prev,
                        balance: payload.new.balance,
                        monthly_quota: payload.new.monthly_quota,
                        purchased_balance: payload.new.purchased_balance
                    }));
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [tenant?.id]);

    const value = {
        user,
        session,
        credits,
        setCredits,
        tenant,
        setTenant,
        tenantId: user?.app_metadata?.tenant_id,
        userRole,
        isAdmin,
        loading,
        signIn,
        signInWithCode,
        signUp,
        signOut,
        resetPassword,
        fetchProfile,
        isFreePlan,
        isExpired,
        trialTimeLeft,
        isProfileLoaded,
        subscription,
        mfaLevel,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuthはAuthProvider内で使用する必要があります');
    }
    return context;
}
