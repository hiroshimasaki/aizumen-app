import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, requiredRole }) {
    const { user, loading, userRole } = useAuth();

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
            <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <span className="ml-3 text-slate-400 font-medium">読み込み中...</span>
        </div>
    );

    if (!user) {
        if (window.location.pathname.startsWith('/super-admin')) {
            return <Navigate to="/platform-login" replace />;
        }
        return <Navigate to="/login" replace />;
    }

    // Super Admin (SU) のアクセス制限
    // SU は /super-admin/*, /forum 以外の保護されたルートにアクセスしてはならない
    const isAllowedForSU = window.location.pathname.startsWith('/super-admin') ||
        window.location.pathname.startsWith('/platform-setup-mfa') ||
        window.location.pathname.startsWith('/forum');

    if (userRole === 'super_admin' && !isAllowedForSU && requiredRole !== 'super_admin') {
        return <Navigate to="/" replace />;
    }

    if (requiredRole) {
        // system_admin はテナント内の全ての権限をバイパスできる
        if (userRole === 'system_admin' && requiredRole !== 'super_admin') return children;

        if (userRole !== requiredRole) {
            const redirectPath = userRole === 'super_admin' ? '/super-admin' : '/quotations';
            return <Navigate to={redirectPath} replace />;
        }
    }

    return children;
}
