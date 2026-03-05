import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { LogOut, Database, BarChart3, Settings, Zap, Menu, X, CalendarDays, TrendingUp, AlertTriangle, UserCog } from 'lucide-react';

// Auth pages
import LoginPage from './components/auth/LoginPage';
import SignUpPage from './components/auth/SignUpPage';

// Pages
import QuotationsPage from './pages/QuotationsPage';
import DashboardPage from './pages/DashboardPage';
import AnalysisPage from './pages/AnalysisPage';
import AdminPage from './pages/AdminPage';
import LandingPage from './pages/LandingPage';
import SuperAdminPage from './pages/SuperAdminPage';
import PlatformLoginPage from './pages/PlatformLoginPage';
import MFASetupPage from './pages/MFASetupPage';

// Legal pages
import TermsOfService from './pages/site/Tos';
import PrivacyPolicy from './pages/site/Rules';
import CommercialTransaction from './pages/site/Trx';
import DataProtectionPolicy from './pages/site/Dpp';

// App Layout (共通ヘッダー+ナビゲーション)
function AppLayout() {
    const { user, tenant, userRole, signOut, credits, isFreePlan, isTrialExpired, trialDaysLeft, isProfileLoaded } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // Force redirect to billing if trial is expired
    useEffect(() => {
        if (isFreePlan && isTrialExpired) {
            // Check if user is already on the billing page or logout
            const isBillingPath = location.pathname.startsWith('/admin') && location.search.includes('tab=billing');
            if (!isBillingPath) {
                navigate('/admin?tab=billing', { replace: true });
            }
        }
    }, [isFreePlan, isTrialExpired, location, navigate]);
    const navItems = [];

    // 一般ユーザー用のメニュー
    if (isProfileLoaded && userRole !== 'super_admin') {
        navItems.push({ path: '/quotations', label: '案件一覧', icon: Database });
        navItems.push({ path: '/dashboard', label: 'ガントチャート', icon: CalendarDays });
    }

    // プロフィール読み込みが完了し、かつ管理者権限がある場合のみメニューを追加
    if (isProfileLoaded && ['admin', 'system_admin'].includes(userRole)) {
        navItems.push({ path: '/analysis', label: 'データ分析', icon: TrendingUp });
        navItems.push({ path: '/admin', label: '管理', icon: Settings });
    }

    // サービス管理者（Super Admin / SU）専用メニュー
    if (isProfileLoaded && userRole === 'super_admin') {
        navItems.push({ path: '/super-admin', label: 'サービス管理', icon: UserCog });
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

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Header */}
            <header className="bg-slate-800/80 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
                    {/* Logo */}
                    <Link to={userRole === 'super_admin' ? '/super-admin' : '/quotations'} className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-cyan-400" />
                        <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                            AiZumen
                        </span>
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
                                    {item.label}
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
                                        {item.label}
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
                <div className={`${isTrialExpired ? 'bg-red-900/40 border-red-500/30' : 'bg-amber-900/30 border-amber-500/20'} border-b backdrop-blur-sm`}>
                    <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                            <AlertTriangle className={`w-4 h-4 ${isTrialExpired ? 'text-red-400' : 'text-amber-400'}`} />
                            {isTrialExpired ? (
                                <span className="text-red-300 font-medium">無料トライアルが終了しました。AI解析機能を継続するにはプランを選択してください。</span>
                            ) : (
                                <span className="text-amber-300 font-medium">無料トライアル: 残り <strong>{trialDaysLeft}日</strong></span>
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

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-6">
                <Outlet />
            </main>
        </div>
    );
}

import { NotificationProvider } from './contexts/NotificationContext';

function LandingRoute() {
    const { user, loading, userRole } = useAuth();
    if (loading) return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin"></div>
        </div>
    );
    if (user) {
        return userRole === 'super_admin'
            ? <Navigate to="/super-admin" replace />
            : <Navigate to="/quotations" replace />;
    }
    return <LandingPage />;
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

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <NotificationProvider>
                    <ScrollToTop />
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignUpPage />} />
                        <Route path="/agreement" element={<TermsOfService />} />
                        <Route path="/site-policy" element={<PrivacyPolicy />} />
                        <Route path="/commerce" element={<CommercialTransaction />} />
                        <Route path="/protection" element={<DataProtectionPolicy />} />

                        {/* Super Admin (SU) 専用認証ルート */}
                        <Route path="/platform-login" element={<PlatformLoginPage />} />
                        <Route path="/platform-setup-mfa" element={<MFASetupPage />} />

                        {/* Protected Routes inside AppLayout */}
                        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                            <Route path="/quotations" element={<QuotationsPage />} />
                            <Route path="/dashboard" element={<DashboardPage />} />
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
