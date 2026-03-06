const { ipcRenderer } = require('electron');
const axios = require('axios');

let userToken = null;
const apiBaseUrl = 'http://localhost:3001';

// DOM Elements
const loginSection = document.getElementById('login-section');
const mainContent = document.getElementById('main-content');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const authStatus = document.getElementById('auth-status');
const folderPathInput = document.getElementById('folder-path');
const selectFolderBtn = document.getElementById('select-folder-btn');
const analyzeAllBtn = document.getElementById('analyze-all-btn');
const fileListContainer = document.getElementById('file-list');
const fileCountLabel = document.getElementById('file-count');

// Login Handler
loginBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    if (!email || !password) return alert('入力してください');

    loginBtn.disabled = true;
    loginBtn.innerText = 'ログイン中...';

    try {
        // AIZumen APIで認証
        const response = await axios.post(`${apiBaseUrl}/api/auth/login`, {
            email,
            password,
            clientType: 'hotfolder'
        });
        userToken = response.data.session.access_token;

        // UI切り替え
        loginSection.classList.add('hidden');
        mainContent.classList.remove('hidden');
        authStatus.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span>ログイン中';
    } catch (err) {
        console.error('Login failed:', err);
        alert('ログインに失敗しました。認証情報を確認してください。');
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerText = 'ログイン';
    }
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
            <div class="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                <p class="text-xs">図面を監視フォルダに入れてください</p>
            </div>
        `;
        analyzeAllBtn.disabled = true;
        return;
    }

    analyzeAllBtn.disabled = !files.some(f => f.status === 'detected' || f.status === 'error');

    fileListContainer.innerHTML = files.map(file => {
        let statusBadge = '';
        switch (file.status) {
            case 'detected': statusBadge = '<span class="text-blue-400">待機中</span>'; break;
            case 'processing': statusBadge = '<span class="text-amber-400 animate-pulse">解析中...</span>'; break;
            case 'completed': statusBadge = '<span class="text-emerald-500">完了</span>'; break;
            case 'error': statusBadge = `<span class="text-red-500" title="${file.errorMessage || ''}">エラー</span>`; break;
        }

        return `
            <div class="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-white/5 group">
                <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium truncate">${file.name}</p>
                    <p class="text-[10px] text-slate-500">${statusBadge}</p>
                </div>
                ${file.status === 'detected' || file.status === 'error' ? `
                    <button onclick="removeFile('${file.path}')" class="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-md transition-colors text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
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
    if (!userToken) return alert('再度ログインしてください');
    ipcRenderer.send('start-bulk-analysis', userToken);
});
