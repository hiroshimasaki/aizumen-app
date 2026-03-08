import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    timeout: 30000,
});

// リクエストインターセプター：最新のJWTトークンを自動付加
api.interceptors.request.use(async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
});

// レスポンスインターセプター：401で自動ログアウト、503でメンテナンス画面
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        // メンテナンスモード (503 Service Unavailable)
        if (error.response?.status === 503 && error.response?.data?.maintenance) {
            const publicUIPaths = ['/', '/agreement', '/site-policy', '/commerce', '/protection'];
            if (window.location.pathname !== '/maintenance' && !publicUIPaths.includes(window.location.pathname)) {
                window.location.href = '/maintenance';
            }
            // メンテナンス画面遷移時または公共ページ表示時はエラーを返す（データ取得をブロック）
            return Promise.reject(error);
        }

        if (error.response?.status === 401) {
            const isAuthRequest = error.config?.url?.includes('/api/auth/login') || 
                                 error.config?.url?.includes('/api/auth/login-with-code') ||
                                 error.config?.url?.includes('/api/auth/signup');
            const isLoginPage = window.location.pathname === '/login' || 
                               window.location.pathname === '/platform-login' ||
                               window.location.pathname === '/signup';
            
            const publicUIPaths = ['/', '/agreement', '/site-policy', '/commerce', '/protection', '/update-password', '/reset-password'];
            const isPublicPage = isLoginPage || publicUIPaths.includes(window.location.pathname);
            
            if (isAuthRequest || isPublicPage) {
                // ログイン画面での認証失敗時は自動リダイレクト（リロード）を避ける
                // これにより React の状態（表示中のアラート等）が維持される
                return Promise.reject(error);
            }

            await supabase.auth.signOut();
            window.location.href = '/login';
        } else if (error.response?.status === 403) {
            const isMFAError = error.response?.data?.code === 'MFA_VERIFICATION_REQUIRED';

            // MFAが必要な場合はセットアップ画面へ
            if (isMFAError) {
                window.location.href = '/platform-setup-mfa';
                return Promise.reject(error);
            }

            // 一般ユーザーのみ /quotations へ戻す (SUの場合は無限ループを防ぐため何もしない)
            // ※AuthContextの状態に依存しないよう、URLや直感的な判定が必要な場合もあるが、まずは一律ガード
            if (!window.location.pathname.startsWith('/super-admin')) {
                window.location.href = '/quotations';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
