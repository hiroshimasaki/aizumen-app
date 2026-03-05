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

// レスポンスインターセプター：401で自動ログアウト
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            if (error.response?.data?.code === 'MULTI_LOGIN') {
                window.dispatchEvent(new CustomEvent('app-show-alert', {
                    detail: {
                        message: '他のブラウザまたは端末からログインされたため、自動的にログアウトしました。',
                        type: 'info'
                    }
                }));
            } else if (error.response?.data?.code === 'USER_DEACTIVATED') {
                window.dispatchEvent(new CustomEvent('app-show-alert', {
                    detail: {
                        message: 'このアカウントは管理者によって無効化されました。ログオフします。',
                        type: 'error'
                    }
                }));
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
