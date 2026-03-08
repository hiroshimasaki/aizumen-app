import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { LogOut, Database, BarChart3, Settings, Zap, Menu, X, CalendarDays, TrendingUp, AlertTriangle, UserCog, MessageSquare } from 'lucide-react';
import api from './lib/api';
import { NotificationProvider } from './contexts/NotificationContext';

// Auth pages
import LoginPage from './components/auth/LoginPage';
import SignUpPage from './components/auth/SignUpPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import UpdatePasswordPage from './components/auth/UpdatePasswordPage';

// Pages
import QuotationsPage from './pages/QuotationsPage';
import DashboardPage from './pages/DashboardPage';
import AnalysisPage from './pages/AnalysisPage';
import AdminPage from './pages/AdminPage';
import LandingPage from './pages/LandingPage';
import SuperAdminPage from './pages/SuperAdminPage';
import PlatformLoginPage from './pages/PlatformLoginPage';
import MFASetupPage from './pages/MFASetupPage';
import ForumPage from './pages/ForumPage';
import MaintenancePage from './pages/MaintenancePage';

// Legal pages
import TermsOfService from './pages/site/Tos';
import PrivacyPolicy from './pages/site/Rules';
import CommercialTransaction from './pages/site/Trx';
import DataProtectionPolicy from './pages/site/Dpp';

// App Layout (共通ヘッダー+ナビゲーション)
function AppLayout() {
    const { user, tenant, userRole, signOut, credits, isFreePlan,
        isExpired,
        trialTimeLeft,
        isProfileLoaded,
        subscription,
    } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // Force redirect to billing if trial/subscription is expired
    useEffect(() => {
        if (isExpired) {
            // Check if user is already on the billing page or logout
            const isBillingPath = location.pathname.startsWith('/admin') && location.search.includes('tab=billing');
            if (!isBillingPath) {
                navigate('/admin?tab=billing', { replace: true });
            }
        }
    }, [isExpired, location, navigate]);

    // 背景スクロールロック (期限切れブロック時)
    useEffect(() => {
        if (isExpired && !location.search.includes('tab=billing')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isExpired, location.search]);

    const navItems = [];

    // 一般ユーザー用のメニュー
    if (isProfileLoaded && userRole !== 'super_admin') {
        navItems.push({ path: '/quotations', label: '案件一覧', icon: Database, roles: ['user', 'admin', 'system_admin'] });
        navItems.push({ path: '/dashboard', label: 'ガントチャート', icon: CalendarDays, roles: ['user', 'admin', 'system_admin'] });
        navItems.push({ path: '/forum', label: 'フォーラム', icon: MessageSquare, roles: ['user', 'admin', 'system_admin'] });
    }

    // プロフィール読み込みが完了し、かつ管理者権限がある場合のみメニューを追加
    if (isProfileLoaded && ['admin', 'system_admin'].includes(userRole)) {
        navItems.push({ path: '/analysis', label: 'データ分析', icon: TrendingUp, roles: ['admin', 'system_admin'] });
        navItems.push({ path: '/admin', label: '管理', icon: Settings, roles: ['admin', 'system_admin'] });
    }

    // サービス管理者（Super Admin / SU）専用メニュー
    if (isProfileLoaded && userRole === 'super_admin') {
        navItems.push({ path: '/forum', label: 'フォーラム', icon: MessageSquare, roles: ['super_admin'] });
        navItems.push({ path: '/super-admin', label: 'サービス管理', icon: UserCog, roles: ['super_admin'] });
    }

    // Close menu on route change
    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };
        if (menuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen]);

    // ストレージ警告の計算
    const storageUsageGB = (subscription?.storageUsage || 0) / (1024 * 1024 * 1024);
    const maxStorageGB = subscription?.maxStorageGB || 1;
    const storagePercent = (storageUsageGB / maxStorageGB) * 100;
    const isStorageWarning = storagePercent >= 80;

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Header */}
            <header className="bg-slate-800/80 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
                    {/* Logo */}
                    <Link to={userRole === 'super_admin' ? '/super-admin' : '/quotations'} className="flex items-center gap-2 group">
                        <div className="relative">
                            <Zap className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
                            {import.meta.env.DEV && (
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                            )}
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                                AiZumen
                            </span>
                            {import.meta.env.DEV && (
                                <span className="text-[10px] font-black px-1.5 py-0.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded uppercase tracking-tighter leading-none mb-0.5">
                                    Dev
                                </span>
                            )}
                        </div>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navItems.map(item => {
                            const Icon = item.icon;
                            const isActive = location.pathname.startsWith(item.path);
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${isActive
                                        ? 'bg-blue-500/20 text-blue-300'
                                        : 'text-white/60 hover:text-white hover:bg-white/10'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span>{item.label}</span>
                                    <div className="flex gap-0.5 ml-0.5">
                                        {item.roles?.includes('system_admin') && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" title="システム管理者" />
                                        )}
                                        {item.roles?.includes('admin') && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" title="管理者" />
                                        )}
                                        {item.roles?.includes('user') && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400" title="一般ユーザー" />
                                        )}
                                        {item.roles?.includes('super_admin') && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" title="サービス管理者" />
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Right Side: Credits + User + Hamburger */}
                    <div className="flex items-center gap-3">
                        {userRole !== 'super_admin' && (
                            <Link
                                to="/admin?tab=billing"
                                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-900/30 border border-indigo-500/30 rounded-full text-indigo-300 hover:bg-indigo-800/40 transition-all active:scale-95"
                            >
                                <Zap className="w-4 h-4 text-amber-400" />
                                <span className="text-xs font-bold">
                                    残り: {credits?.balance || 0}
                                    {credits?.purchased_balance > 0 && (
                                        <span className="text-[10px] text-indigo-400 font-normal ml-1 border pl-1 border-indigo-500/30 rounded">
                                            うち追加分: {credits.purchased_balance}
                                        </span>
                                    )}
                                </span>
                            </Link>
                        )}
                        {/* Super Admin Dashboard Portal Target */}
                        <div id="su-header-portal" />

                        <div className="text-right hidden md:block border-l border-white/10 pl-4">
                            <div className="text-sm font-medium text-white/90">
                                {user?.profile?.name || (
                                    <span className="opacity-0">読み込み中...</span>
                                )}
                            </div>
                            <div className="text-[10px] text-white/40 uppercase tracking-wider">{tenant?.name || '読み込み中...'}</div>
                        </div>
                        <button
                            onClick={signOut}
                            className="hidden md:block p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
                            title="ログアウト"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>

                        {/* Hamburger Button (Mobile) */}
                        <button
                            onClick={() => setMenuOpen(!menuOpen)}
                            className="md:hidden p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
                            aria-label="メニュー"
                        >
                            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu Dropdown */}
                {menuOpen && (
                    <div
                        ref={menuRef}
                        className="md:hidden absolute top-14 left-0 right-0 bg-slate-800/95 backdrop-blur-xl border-b border-white/10 shadow-2xl animate-in slide-in-from-top-2 duration-200 z-40"
                    >
                        <div className="max-w-7xl mx-auto p-4 space-y-1">
                            {navItems.map(item => {
                                const Icon = item.icon;
                                const isActive = location.pathname.startsWith(item.path);
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive
                                            ? 'bg-blue-500/20 text-blue-300'
                                            : 'text-white/70 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span>{item.label}</span>
                                        <div className="flex gap-1 ml-auto">
                                            {item.roles?.includes('system_admin') && (
                                                <div className="w-2 h-2 rounded-full bg-amber-500" />
                                            )}
                                            {item.roles?.includes('admin') && (
                                                <div className="w-2 h-2 rounded-full bg-purple-500" />
                                            )}
                                            {item.roles?.includes('user') && (
                                                <div className="w-2 h-2 rounded-full bg-slate-400" />
                                            )}
                                            {item.roles?.includes('super_admin') && (
                                                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                                            )}
                                        </div>
                                    </Link>
                                );
                            })}

                            {/* User Info + Logout in Mobile */}
                            <div className="border-t border-white/10 mt-3 pt-3">
                                <div className="flex items-center justify-between px-4 py-2">
                                    <div>
                                        <div className="text-sm font-medium text-white/90">
                                            {user?.profile?.name || '読み込み中...'}
                                        </div>
                                        <div className="text-[10px] text-white/40 uppercase tracking-wider">
                                            {tenant?.name || '読み込み中...'}
                                        </div>
                                    </div>
                                    <button
                                        onClick={signOut}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        ログアウト
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Trial Banner */}
            {isFreePlan && (
                <div className={`${isExpired ? 'bg-red-900/40 border-red-500/30' : 'bg-amber-900/30 border-amber-500/20'} border-b backdrop-blur-sm`}>
                    <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                            <AlertTriangle className={`w-4 h-4 ${isExpired ? 'text-red-400' : 'text-amber-400'}`} />
                            {isExpired ? (
                                <span className="text-red-300 font-medium">無料トライアルが終了しました。AI解析機能を継続するにはプランを選択してください。</span>
                            ) : (
                                <span className="text-amber-300 font-medium">無料トライアル: <strong>{trialTimeLeft}</strong></span>
                            )}
                        </div>
                        <Link
                            to="/admin?tab=billing"
                            className="px-4 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-bold rounded-full hover:from-blue-400 hover:to-cyan-400 transition-all"
                        >
                            プランを選択
                        </Link>
                    </div>
                </div>
            )}

            {/* Storage Warning Banner */}
            {!isExpired && isStorageWarning && (
                <div className="bg-amber-900/30 border-b border-amber-500/20 backdrop-blur-sm">
                    <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-amber-300 font-medium">
                            <TrendingUp className="w-4 h-4" />
                            <span>
                                ストレージ使用量: {maxStorageGB.toFixed(1)}GBのうち{storageUsageGB.toFixed(1)}GBを使用（{Math.floor(storagePercent)}％）
                            </span>
                        </div>
                        <Link
                            to="/admin?tab=billing"
                            className="px-4 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-full hover:bg-amber-500/30 transition-all"
                        >
                            プランをアップグレード
                        </Link>
                    </div>
                </div>
            )}

            {/* Expired Hard Block Modal (Free/Paid共通) */}
            {isExpired && !location.search.includes('tab=billing') && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-500">
                    <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-[2rem] p-8 shadow-2xl shadow-red-900/20 text-center animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-10 h-10 text-red-500" />
                        </div>
                        <h2 className="text-2xl font-black text-white mb-2">{isFreePlan ? '無料トライアル期限終了' : 'サブスクリプション期限終了'}</h2>
                        <p className="text-slate-400 mb-8 text-sm leading-relaxed">
                            {isFreePlan
                                ? '7日間の無料トライアル期間が終了しました。引き続きAI解析や案件管理をご利用いただくには、有料プランへの移行が必要です。'
                                : 'サブスクリプションの有効期限が終了しました。引き続きご利用いただくには、お支払い情報の更新または再契約が必要です。'
                            }
                        </p>
                        <div className="flex flex-col gap-3">
                            <Link
                                to="/admin?tab=billing"
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-xl hover:from-blue-500 hover:to-cyan-500 transition-all shadow-lg shadow-blue-500/20"
                            >
                                プランを選択する
                            </Link>
                            <button
                                onClick={signOut}
                                className="w-full py-3 bg-white/5 text-slate-400 font-bold rounded-xl hover:bg-white/10 transition-all"
                            >
                                ログアウト
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-6">
                <Outlet />
            </main>
        </div>
    );
}

/**
 * ページ遷移時に自動的に最上部へスクロールするコンポーネント
 */
function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
}

/**
 * メンテナンスページ用ルート
 * URLクエリからメッセージを取得して表示する
 */
function MaintenanceRoute() {
    const [searchParams] = useSearchParams();
    const message = searchParams.get('m');
    return <MaintenancePage message={message} />;
}

function LandingRoute() {
    const { user, loading, userRole, mfaLevel } = useAuth();
    if (loading) return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin"></div>
        </div>
    );
    if (user) {
        if (userRole === 'super_admin') {
            // MFAが完了していない場合はフォーラムへ、完了していればサービス管理へ
            return mfaLevel === 'aal2' 
                ? <Navigate to="/super-admin" replace /> 
                : <Navigate to="/forum" replace />;
        }
        return <Navigate to="/quotations" replace />;
    }
    return <LandingPage />;
}

export default function App() {
    useEffect(() => {
        const handleError = async (eventOrError) => {
            let error = null;
            if (eventOrError instanceof PromiseRejectionEvent) {
                error = eventOrError.reason;
            } else if (eventOrError instanceof ErrorEvent) {
                error = eventOrError.error;
            } else {
                error = eventOrError;
            }

            if (!error) return;

            // メンテナンスモードのハンドリング (503 Service Unavailable)
            if (error.response?.status === 503 && error.response?.data?.maintenance) {
                // すでにメンテナンス画面にいる場合はスキップ
                if (window.location.pathname !== '/maintenance') {
                    const params = new URLSearchParams();
                    if (error.response.data.message) {
                        params.set('m', error.response.data.message);
                    }
                    window.location.href = `/maintenance?${params.toString()}`;
                }
                return;
            }

            try {
                api.post('/api/auth/report-error', {
                    message: error.message || 'Unknown error',
                    stack: error.stack,
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                    source: 'client_global'
                }).catch(e => console.warn('Failed silence report:', e));
            } catch (e) {
            }
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleError);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleError);
        };
    }, []);

    return (
        <BrowserRouter>
            <AuthProvider>
                <NotificationProvider>
                    <ScrollToTop />
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignUpPage />} />
                        <Route path="/reset-password" element={<ForgotPasswordPage />} />
                        <Route path="/update-password" element={<UpdatePasswordPage />} />
                        <Route path="/agreement" element={<TermsOfService />} />
                        <Route path="/site-policy" element={<PrivacyPolicy />} />
                        <Route path="/commerce" element={<CommercialTransaction />} />
                        <Route path="/protection" element={<DataProtectionPolicy />} />
                        <Route path="/maintenance" element={<MaintenanceRoute />} />

                        {/* Super Admin (SU) 専用認証ルート */}
                        <Route path="/platform-login" element={<PlatformLoginPage />} />
                        <Route path="/platform-setup-mfa" element={
                            <ProtectedRoute><MFASetupPage /></ProtectedRoute>
                        } />

                        {/* Protected Routes inside AppLayout */}
                        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                            <Route path="/quotations" element={<QuotationsPage />} />
                            <Route path="/dashboard" element={<DashboardPage />} />
                            <Route path="/forum" element={<ForumPage />} />
                            <Route path="/analysis" element={
                                <ProtectedRoute requiredRole="admin"><AnalysisPage /></ProtectedRoute>
                            } />
                            <Route path="/admin/*" element={
                                <ProtectedRoute requiredRole="admin"><AdminPage /></ProtectedRoute>
                            } />
                            <Route path="/super-admin/*" element={
                                <ProtectedRoute requiredRole="super_admin"><SuperAdminPage /></ProtectedRoute>
                            } />
                        </Route>

                        {/* Default redirect */}
                        <Route path="/" element={<LandingRoute />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </NotificationProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}
