const electron = require('electron');
const { app, BrowserWindow, ipcMain, dialog, Notification, Menu, Tray, nativeImage } = electron.app ? electron : (typeof electron === 'object' && electron.default ? electron.default : electron);
const path = require('path');
const chokidar = require('chokidar');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const notifier = require('node-notifier');

let mainWindow;
let watcher;
let pendingFiles = [];
let authToken = null;
const apiBaseUrl = 'http://localhost:3001';
let watchFolder = null;
let tray = null; // トレイアイコン用
let minimizeOnClose = true; // 閉じるボタンで最小化するかどうか
app.isQuiting = false; // 終了フラグの初期化

const getConfigPath = () => path.join(app.getPath('userData'), 'hotfolder-config.json');

function loadConfig() {
    try {
        if (fs.existsSync(getConfigPath())) {
            const config = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
            if (config.minimizeOnClose !== undefined) {
                minimizeOnClose = config.minimizeOnClose;
            }
            return config;
        }
    } catch (e) {
        console.error('Failed to load config', e);
    }
    return {};
}

function saveConfig(config) {
    try {
        fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
    } catch (e) {
        console.error('Failed to save config', e);
    }
}

function createWindow() {
    loadConfig(); // 起動時に設定を読み込む
    const { Menu, Tray, nativeImage } = electron;
    const iconImage = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));

    mainWindow = new BrowserWindow({
        width: 900,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        title: 'AiZumen ホットフォルダ監視',
        icon: iconImage, // ここでアイコンを設定
    });

    mainWindow.loadFile('index.html');
    
    // システムトレイの設定
    const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
    
    const contextMenu = Menu.buildFromTemplate([
        { label: 'アプリを開く', click: () => mainWindow.show() },
        { type: 'separator' },
        { label: '終了', click: () => {
            app.isQuiting = true;
            app.quit();
        }}
    ]);
    
    tray.setToolTip('AiZumen HotFolder');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        mainWindow.show();
    });

    // 最小化（Minimize）時
    mainWindow.on('minimize', (event) => {
        if (minimizeOnClose) {
            // トグルON: トレイに隠す
            event.preventDefault();
            mainWindow.hide();
        }
        // トグルOFF: 通常の最小化（タスクバーへ）
    });

    // 閉じる（Close）ボタンを押した時
    mainWindow.on('close', (event) => {
        if (app.isQuiting) return;

        if (minimizeOnClose) {
            // トグルON: 最小化（隠す）
            event.preventDefault();
            mainWindow.hide();
        } else {
            // トグルOFF: 終了
            app.quit();
        }
    });
}

// IPC Handlers
ipcMain.on('update-minimize-config', (event, value) => {
    minimizeOnClose = value;
});

// カスタムメニューの設定 (File -> Exit のみ)
const menuTemplate = [
    {
        label: 'File',
        submenu: [
            {
                label: 'Exit',
                click: () => {
                    app.isQuiting = true;
                    app.quit();
                }
            }
        ]
    }
];
const menu = Menu.buildFromTemplate(menuTemplate);
Menu.setApplicationMenu(menu);

// 終了フラグの管理
app.on('before-quit', () => {
    app.isQuiting = true;
});

// 二重起動防止 (Single Instance Lock)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // 2つ目のインスタンスが起動しようとした場合、既存のウィンドウを前面に出す
        if (mainWindow) {
            if (mainWindow.isMinimized() || !mainWindow.isVisible()) {
                mainWindow.show();
                mainWindow.restore();
            }
            mainWindow.focus();
        }
    });

    app.whenReady().then(createWindow);
}

app.on('before-quit', () => {
    app.isQuiting = true;
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// フォルダ監視の開始/更新
let isLoggedIn = false; // ログイン状態管理

ipcMain.on('auth-success', (event, token) => {
    authToken = token;
    isLoggedIn = true;
});

ipcMain.on('auth-logout', () => {
    authToken = null;
    isLoggedIn = false;
});

ipcMain.on('set-watch-folder', (event, folderPath) => {
    if (watcher) {
        watcher.close();
    }

    watchFolder = folderPath;
    
    // 設定を保存
    const config = loadConfig();
    config.watchFolder = watchFolder;
    saveConfig(config);

    const processedDir = path.join(watchFolder, 'processed');
    if (!fs.existsSync(processedDir)) {
        fs.mkdirSync(processedDir);
    }

    let isReady = false;
    watcher = chokidar.watch(watchFolder, {
        ignored: [/(^|[\/\\])\../, processedDir], // . で始まるファイルと processed フォルダを無視
        persistent: true,
        depth: 0, // 直下のファイルのみ
    });

    watcher.on('add', (filePath) => {
        if (path.extname(filePath).toLowerCase() === '.pdf') {
            const fileName = path.basename(filePath);
            // すでにリストにないかチェック
            if (!pendingFiles.some(f => f.path === filePath)) {
                pendingFiles.push({ name: fileName, path: filePath, status: 'detected' });

                // ログイン中 かつ 初期スキャン完了後のみ通知を出す
                if (isLoggedIn && isReady) {
                    new Notification({
                        title: '新しい書類を検知しました',
                        body: `${fileName} を待機リストに追加しました。`,
                    }).show();
                }

                // 準備完了後なら即座に送信
                if (isReady) {
                    mainWindow.webContents.send('update-file-list', pendingFiles);
                }
            }
        }
    });

    watcher.on('ready', () => {
        isReady = true;
        // 初期スキャン完了後に一括送信
        mainWindow.webContents.send('update-file-list', pendingFiles);
    });

    // ファイルが直接削除された場合の検知
    watcher.on('unlink', (filePath) => {
        if (path.extname(filePath).toLowerCase() === '.pdf') {
            const initialLength = pendingFiles.length;
            pendingFiles = pendingFiles.filter(f => f.path !== filePath);
            
            if (pendingFiles.length !== initialLength) {
                mainWindow.webContents.send('update-file-list', pendingFiles);
            }
        }
    });

    event.reply('folder-set-success', folderPath);
});

// フォルダ選択ダイアログ
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result.filePaths[0];
});

// 設定項目取得用
ipcMain.handle('get-config', () => {
    return loadConfig();
});

// 設定更新用
ipcMain.on('update-config', (event, newConfig) => {
    const currentConfig = loadConfig();
    saveConfig({ ...currentConfig, ...newConfig });
});

// ファイル削除（リストから除外）
ipcMain.on('remove-file', (event, filePath) => {
    pendingFiles = pendingFiles.filter(f => f.path !== filePath);
    mainWindow.webContents.send('update-file-list', pendingFiles);
});

// 一括解析実行
ipcMain.on('start-bulk-analysis', async (event, token) => {
    authToken = token;
    const filesToProcess = pendingFiles.filter(f => f.status === 'detected' || f.status === 'error');

    for (const file of filesToProcess) {
        try {
            file.status = 'processing';
            mainWindow.webContents.send('update-file-list', pendingFiles);

            // 1. OCR解析
            const formData = new FormData();
            formData.append('file', fs.createReadStream(file.path));

            const ocrResponse = await axios.post(`${apiBaseUrl}/api/ocr/analyze`, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${authToken}`,
                    'X-Client-Type': 'hotfolder'
                }
            });

            if (ocrResponse.status !== 200) {
                throw new Error(ocrResponse.data?.error || `OCR解析エラー (Status: ${ocrResponse.status})`);
            }

            const ocrData = ocrResponse.data;

            // 2. 案件登録
            const items = (ocrData.items && ocrData.items.length > 0)
                ? ocrData.items.map(aiItem => ({
                    name: aiItem.name || file.name.split('.')[0],
                    quantity: aiItem.quantity || 1,
                    processingCost: aiItem.price || 0,
                    materialCost: 0,
                    dueDate: aiItem.dueDate || ''
                }))
                : [{
                    name: file.name.split('.')[0],
                    quantity: 1,
                    processingCost: 0,
                    materialCost: 0,
                    dueDate: ''
                }];

            const quotationPayload = {
                companyName: ocrData.companyName || '自動作成（ホットフォルダ）',
                orderNumber: ocrData.orderNumber || '',
                constructionNumber: ocrData.constructionNumber || '',
                status: 'ordered',
                notes: ocrData.notes || 'ホットフォルダから自動投入',
                items: items
            };

            const quoteResponse = await axios.post(`${apiBaseUrl}/api/quotations`, quotationPayload, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'X-Client-Type': 'hotfolder'
                }
            });

            if (quoteResponse.status !== 200 && quoteResponse.status !== 201) {
                throw new Error(quoteResponse.data?.error || `案件登録エラー (Status: ${quoteResponse.status})`);
            }

            const newQuote = quoteResponse.data;

            // 3. ファイルアップロード
            if (newQuote && newQuote.id) {
                const uploadFormData = new FormData();
                uploadFormData.append('quotationId', newQuote.id);
                uploadFormData.append('files', fs.createReadStream(file.path));

                const uploadResponse = await axios.post(`${apiBaseUrl}/api/files/upload`, uploadFormData, {
                    headers: {
                        ...uploadFormData.getHeaders(),
                        'Authorization': `Bearer ${authToken}`,
                        'X-Client-Type': 'hotfolder'
                    }
                });

                if (uploadResponse.status !== 201 && uploadResponse.status !== 200) {
                    throw new Error(uploadResponse.data?.error || `ファイル登録エラー (Status: ${uploadResponse.status})`);
                }
            }

            // 4. 後処理（移動）
            const processedPath = path.join(watchFolder, 'processed', file.name);
            fs.renameSync(file.path, processedPath);

            file.status = 'completed';
            file.path = processedPath; // 移動後のパスに更新
            delete file.errorMessage;
        } catch (err) {
            console.error(`Error processing ${file.name}:`, err.response?.data || err.message);
            file.status = 'error';
            // サーバー側から返ってきた具体的なエラー詳細を抽出して表示
            file.errorMessage = err.response?.data?.error || err.response?.data?.message || err.message;
        }

        mainWindow.webContents.send('update-file-list', pendingFiles);
    }

    new Notification({
        title: '一括解析完了',
        body: '選択されたファイルの処理が終了しました。',
    }).show();
});
