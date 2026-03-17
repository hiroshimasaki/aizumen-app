const { ipcRenderer } = require('electron');
const axios = require('axios');

let userToken = null;
const apiBaseUrl = 'https://aizumen-production.up.railway.app';

// DOM Elements
const loginSection = document.getElementById('login-section');

// メインプロセスからのログを表示
ipcRenderer.on('main-log', (event, { message, data }) => {
    console.log(`[Main Process] ${message}`, data || '');
});
const mainContent = document.getElementById('main-content');
const loginBtn = document.getElementById('login-btn');
const authStatus = document.getElementById('auth-status');
const logoutBtn = document.getElementById('logout-btn');

// Login form elements
const tabEmployee = document.getElementById('tab-employee');
const tabAdmin = document.getElementById('tab-admin');
const employeeForm = document.getElementById('employee-form');
const adminForm = document.getElementById('admin-form');

const companyCodeInput = document.getElementById('company-code');
const employeeIdInput = document.getElementById('employee-id');
const employeePasswordInput = document.getElementById('employee-password');

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

const employeeRememberCb = document.getElementById('employee-remember');
const adminRememberCb = document.getElementById('admin-remember');

let activeTab = 'employee'; // 'employee' | 'admin'
const folderPathInput = document.getElementById('folder-path');
const selectFolderBtn = document.getElementById('select-folder-btn');
const analyzeAllBtn = document.getElementById('analyze-all-btn');
const fileListContainer = document.getElementById('file-list');
const fileCountLabel = document.getElementById('file-count');
const minimizeToggle = document.getElementById('minimize-toggle');
const loginErrorContainer = document.getElementById('login-error-container');
const loginErrorText = document.getElementById('login-error-text');

// Tab Switch Logic
tabEmployee.addEventListener('click', (e) => {
    e.preventDefault();
    activeTab = 'employee';
    tabEmployee.className = "flex-1 py-2.5 rounded-lg text-sm font-bold bg-[#6366f1] text-white transition-colors shadow-sm";
    tabAdmin.className = "flex-1 py-2.5 rounded-lg text-sm font-bold text-slate-400 hover:text-slate-200 transition-colors";
    employeeForm.classList.remove('hidden');
    adminForm.classList.add('hidden');
    setTimeout(() => companyCodeInput.focus(), 10); // 入力フィールドを活性化
    hideLoginError();
});

tabAdmin.addEventListener('click', (e) => {
    e.preventDefault();
    activeTab = 'admin';
    tabAdmin.className = "flex-1 py-2.5 rounded-lg text-sm font-bold bg-[#6366f1] text-white transition-colors shadow-sm";
    tabEmployee.className = "flex-1 py-2.5 rounded-lg text-sm font-bold text-slate-400 hover:text-slate-200 transition-colors";
    adminForm.classList.remove('hidden');
    employeeForm.classList.add('hidden');
    setTimeout(() => emailInput.focus(), 10); // 入力フィールドを活性化
    hideLoginError();
});

// Login Handler
const handleLoginEnter = (e) => {
    if (e.key === 'Enter') {
        // アラートが表示されている場合は、ログイン処理を行わない
        if (!customAlert.classList.contains('hidden')) return;
        
        e.preventDefault();
        loginBtn.click();
    }
};
companyCodeInput.addEventListener('keydown', handleLoginEnter);
employeeIdInput.addEventListener('keydown', handleLoginEnter);
employeePasswordInput.addEventListener('keydown', handleLoginEnter);
emailInput.addEventListener('keydown', handleLoginEnter);
passwordInput.addEventListener('keydown', handleLoginEnter);

// Hide error on input
[companyCodeInput, employeeIdInput, employeePasswordInput, emailInput, passwordInput].forEach(input => {
    input.addEventListener('input', () => hideLoginError());
});

function showLoginError(message) {
    const loginCard = loginBtn.closest('div');
    loginErrorText.innerText = mapErrorMessage(message);
    loginErrorContainer.classList.remove('hidden');
    
    // Shake effect
    loginCard.classList.remove('shake');
    void loginCard.offsetWidth; // trigger reflow
    loginCard.classList.add('shake');
}

function hideLoginError() {
    loginErrorContainer.classList.add('hidden');
}

function mapErrorMessage(msg) {
    if (!msg) return 'ログインに失敗しました。';
    
    // msgが文字列でない場合は文字列化
    const message = typeof msg === 'string' ? msg : JSON.stringify(msg);
    
    if (message.includes('Invalid') || message.includes('credentials')) return '会社コード、従業員ID、またはパスワードが正しくありません。';
    if (message.includes('Email and password')) return 'メールアドレスとパスワードを入力してください。';
    if (message.includes('Company code')) return 'すべての項目を入力してください。';
    if (message.includes('deactivated')) return 'このアカウントは現在無効化されています。管理者にお問い合わせください。';
    if (message.includes('permissions')) return '解析を実行する権限がありません。管理者権限を持つアカウントでログインしてください。';
    if (message.includes('Network Error')) return 'サーバーに接続できません。インターネット環境やサーバーの状態を確認してください。';
    if (message.includes('401')) return '認証に失敗しました。入力内容を再度ご確認ください。';
    if (message.includes('403')) return 'アクセスが拒否されました。権限が不足している可能性があります。';
    return message;
}

// Debug log for initialization
console.log('Renderer.js: Initializing v1.2.0...');
ipcRenderer.on('main-log', (event, { message, data }) => {
    console.log(`%c[Main Process] ${message}`, 'color: #3b82f6; font-weight: bold;', data || '');
});
console.log('Main Process log listener attached.');

window.onerror = function(message, source, lineno, colno, error) {
    console.error('GLOBAL ERROR:', message, source, lineno, colno, error);
    if (typeof showAlert === 'function') {
        showAlert('アプリケーションエラーが発生しました: ' + message);
    } else {
        alert('アプリケーションエラー: ' + message);
    }
};

loginBtn.addEventListener('click', async () => {
    console.log('Login button clicked. Current tab:', activeTab);
    hideLoginError();
    
    // ボタンのみ無効化（二重送信防止）
    loginBtn.disabled = true;
    loginBtn.innerText = 'ログイン中...';

    try {
        let response;
        if (activeTab === 'employee') {
            const companyCode = companyCodeInput.value;
            const employeeId = employeeIdInput.value;
            const password = employeePasswordInput.value;
            
            console.log('Attempting employee login for code:', companyCode, 'ID:', employeeId);

            if (!companyCode || !employeeId || !password) {
                throw new Error('すべての項目を入力してください');
            }

            console.log('Sending request to:', `${apiBaseUrl}/api/auth/login-with-code`);
            response = await axios.post(`${apiBaseUrl}/api/auth/login-with-code`, {
                companyCode,
                employeeId,
                password,
                clientType: 'hotfolder'
            });
        } else {
            const email = emailInput.value;
            const password = passwordInput.value;
            
            console.log('Attempting admin login for email:', email);

            if (!email || !password) {
                throw new Error('メールアドレスとパスワードを入力してください');
            }

            console.log('Sending request to:', `${apiBaseUrl}/api/auth/login`);
            response = await axios.post(`${apiBaseUrl}/api/auth/login`, {
                email,
                password,
                clientType: 'hotfolder'
            });
        }
        
        console.log('Login response received:', response.status);
        
        if (!response.data || !response.data.session) {
            console.error('Invalid response structure:', response.data);
            throw new Error('サーバーからの応答が不正です（セッション情報が見つかりません）。');
        }

        userToken = response.data.session.access_token;

        // ログイン情報を保存
        if (activeTab === 'employee') {
            const configData = {
                employeeRemember: employeeRememberCb.checked
            };
            if (employeeRememberCb.checked) {
                configData.lastCompanyCode = companyCodeInput.value;
                configData.lastEmployeeId = employeeIdInput.value;
                configData.lastEmployeePassword = employeePasswordInput.value;
            } else {
                configData.lastCompanyCode = '';
                configData.lastEmployeeId = '';
                configData.lastEmployeePassword = '';
            }
            ipcRenderer.send('update-config', configData);
        } else {
            const configData = {
                adminRemember: adminRememberCb.checked
            };
            if (adminRememberCb.checked) {
                configData.lastAdminEmail = emailInput.value;
                configData.lastAdminPassword = passwordInput.value;
            } else {
                configData.lastAdminEmail = '';
                configData.lastAdminPassword = '';
            }
            ipcRenderer.send('update-config', configData);
        }

        // UI切り替え
        loginSection.classList.add('hidden');
        mainContent.classList.remove('hidden');
        logoutBtn.classList.remove('hidden'); // ログアウトボタンを表示
        authStatus.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" style="animation: none;"></span><span class="text-emerald-400">ログイン中</span>';
        
        // メインプロセスにログイン完了を通知
        ipcRenderer.send('auth-success', userToken);
    } catch (err) {
        console.error('Login failed:', err);
        const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'ログインに失敗しました。';
        
        try {
            showLoginError(errorMessage);
            showAlert(mapErrorMessage(errorMessage)); // モーダルアラートも表示
        } catch (uiErr) {
            console.error('Failed to show UI error:', uiErr);
            alert('ログインエラー: ' + mapErrorMessage(errorMessage));
        }
    } finally {
        // ボタンの状態を復元
        loginBtn.disabled = false;
        loginBtn.innerText = 'ログイン';
    }
});

// Custom Alert Logic
const customAlert = document.getElementById('custom-alert');
const customAlertMessage = document.getElementById('custom-alert-message');

function showAlert(message) {
    customAlertMessage.innerText = message;
    customAlert.classList.remove('hidden');
    // OKボタンにフォーカスを当てて、Enterキーなどで閉じやすくする
    const okBtn = customAlert.querySelector('button');
    if (okBtn) setTimeout(() => okBtn.focus(), 50);
}

window.closeCustomAlert = () => {
    customAlert.classList.add('hidden');
    // ダイアログを閉じたあとにフォーカスを戻す（念のため）
    if (activeTab === 'employee') {
        companyCodeInput.focus();
    } else {
        emailInput.focus();
    }
};

// Logout Handler
logoutBtn.addEventListener('click', () => {
    userToken = null;
    
    // 情報を保存しない設定の場合はフィールドをクリアする
    if (!adminRememberCb.checked) {
        emailInput.value = '';
        passwordInput.value = '';
    }
    if (!employeeRememberCb.checked) {
        companyCodeInput.value = '';
        employeeIdInput.value = '';
        employeePasswordInput.value = '';
    }
    
    loginSection.classList.remove('hidden');
    mainContent.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    
    authStatus.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span><span class="text-slate-400">未ログイン</span>';
    
    // メインプロセスにログアウトを通知
    ipcRenderer.send('auth-logout');
});

// Folder Selection
selectFolderBtn.addEventListener('click', async () => {
    const folderPath = await ipcRenderer.invoke('select-folder');
    if (folderPath) {
        ipcRenderer.send('set-watch-folder', folderPath);
    }
});

ipcRenderer.on('folder-set-success', (event, path) => {
    folderPathInput.value = path;
});

// Update File List UI
ipcRenderer.on('update-file-list', (event, files) => {
    fileCountLabel.innerText = files.length;

    if (files.length === 0) {
        fileListContainer.innerHTML = `
            <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 space-y-4">
                <div class="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center border border-slate-700/50 shadow-inner">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div class="text-center">
                    <p class="text-sm font-medium text-slate-300">書類データがありません</p>
                    <p class="text-xs text-slate-500 mt-1">監視フォルダにPDFファイルを配置してください</p>
                </div>
            </div>
        `;
        analyzeAllBtn.disabled = true;
        return;
    }

    analyzeAllBtn.disabled = !files.some(f => f.status === 'detected' || f.status === 'error');

    fileListContainer.innerHTML = files.map(file => {
        let statusBadge = '';
        switch (file.status) {
            case 'detected': statusBadge = '<div class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.6)]"></span><span class="text-blue-400">待機中</span></div>'; break;
            case 'processing': statusBadge = '<div class="flex items-center gap-1.5"><div class="w-3.5 h-3.5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div><span class="text-amber-400">解析中...</span></div>'; break;
            case 'completed': statusBadge = '<div class="flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500"><path d="M20 6 9 17l-5-5"/></svg><span class="text-emerald-500">完了</span></div>'; break;
            case 'error': 
                statusBadge = `
                    <div class="flex flex-col gap-1">
                        <div class="flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-red-500"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            <span class="text-red-500 font-bold">エラー</span>
                        </div>
                        <p class="text-[10px] text-red-400/90 bg-red-500/5 px-2 py-1 rounded border border-red-500/10 leading-tight break-all">${file.errorMessage || '不明なエラー'}</p>
                    </div>
                `; 
                break;
        }

        return `
            <div class="flex items-center justify-between p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/50 shadow-sm backdrop-blur-md group hover:bg-slate-750/80 transition-colors">
                <div class="min-w-0 flex-1 flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400 group-hover:text-blue-400 transition-colors"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-bold text-slate-200 truncate">${file.name}</p>
                        <p class="text-[11px] text-slate-500 mt-0.5 font-medium">${statusBadge}</p>
                    </div>
                </div>
                ${file.status === 'detected' || file.status === 'error' ? `
                    <button onclick="removeFile('${file.path.replace(/\\/g, '\\\\')}')" class="p-2 hover:bg-red-500/15 hover:text-red-400 rounded-lg transition-all text-slate-500 opacity-0 group-hover:opacity-100 focus:opacity-100">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');
});

// Global for inline onclick
window.removeFile = (path) => {
    ipcRenderer.send('remove-file', path);
};

// Start Bulk Analyze
analyzeAllBtn.addEventListener('click', () => {
    if (!userToken) return showAlert('再度ログインしてください');
    ipcRenderer.send('start-bulk-analysis', userToken);
});

// DOM Elements
const autoAnalysisToggle = document.getElementById('auto-analysis-toggle');

// Minimize Toggle Handler
if (minimizeToggle) {
    minimizeToggle.addEventListener('change', () => {
        const configData = {
            minimizeOnClose: minimizeToggle.checked
        };
        ipcRenderer.send('update-config', configData);
        ipcRenderer.send('update-minimize-config', minimizeToggle.checked);
    });
}

// Auto Analysis Toggle Handler
if (autoAnalysisToggle) {
    autoAnalysisToggle.addEventListener('change', () => {
        const configData = {
            autoAnalysis: autoAnalysisToggle.checked
        };
        ipcRenderer.send('update-config', configData);
        ipcRenderer.send('update-auto-analysis-config', autoAnalysisToggle.checked);
    });
}

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const config = await ipcRenderer.invoke('get-config');
        if (config) {
            // パス
            if (config.watchFolder) {
                folderPathInput.value = config.watchFolder;
                ipcRenderer.send('set-watch-folder', config.watchFolder);
            }

            // 従業員ログイン情報
            if (config.employeeRemember) {
                employeeRememberCb.checked = true;
                companyCodeInput.value = config.lastCompanyCode || '';
                employeeIdInput.value = config.lastEmployeeId || '';
                employeePasswordInput.value = config.lastEmployeePassword || '';
            }

            // 管理者ログイン情報
            if (config.adminRemember) {
                adminRememberCb.checked = true;
                emailInput.value = config.lastAdminEmail || '';
                passwordInput.value = config.lastAdminPassword || '';
            }

            // 最小化設定
            if (config.minimizeOnClose !== undefined && minimizeToggle) {
                minimizeToggle.checked = config.minimizeOnClose;
                ipcRenderer.send('update-minimize-config', config.minimizeOnClose);
            }

            // 自動解析設定
            if (config.autoAnalysis !== undefined && autoAnalysisToggle) {
                autoAnalysisToggle.checked = config.autoAnalysis;
                ipcRenderer.send('update-auto-analysis-config', config.autoAnalysis);
            }
        }
    } catch (e) {
        console.error('Failed to load initial config:', e);
    }
});
