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

const getConfigPath = () => path.join(app.getPath('userData'), 'hotfolder-config.json');

function loadConfig() {
    try {
        if (fs.existsSync(getConfigPath())) {
            return JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
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
    // macOSかWindowsかでデフォルトアイコンがない場合のエラーを防ぐため空Canvasなどで代用も可能ですが、
    // ここではNativeImageを使用するのが一般的。一旦空のオブジェクトかダミーアイコンを用意。
    const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png')); // 無くてもエラーにはならないよう調整
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
    
    const contextMenu = Menu.buildFromTemplate([
        { label: 'アプリを開く', click: () => mainWindow.show() },
        { type: 'separator' },
        { label: '終了', click: () => {
            mainWindow.destroy(); // 終了処理
            app.quit();
        }}
    ]);
    
    tray.setToolTip('AiZumen HotFolder');
    tray.setContextMenu(contextMenu);

    // トレイアイコンをクリックしたら表示
    tray.on('click', () => {
        mainWindow.show();
    });

    // 最小化（Minimize）時にタスクバーから隠す
    mainWindow.on('minimize', (event) => {
        event.preventDefault();
        mainWindow.hide();
    });

    // 閉じる（Close）ボタンを押した時に終了せず、隠す（トレイ化）
    mainWindow.on('close', (event) => {
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });
}

// カスタムメニューの設定 (File -> Exit のみ)
const menuTemplate = [
    {
        label: 'File',
        submenu: [
            {
                label: 'Exit',
                click: () => {
                    app.quit();
                }
            }
        ]
    }
];
const menu = Menu.buildFromTemplate(menuTemplate);
Menu.setApplicationMenu(menu);

app.whenReady().then(createWindow);

app.on('before-quit', () => {
    app.isQuiting = true;
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// フォルダ監視の開始/更新
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

                // 通知
                new Notification({
                    title: '新しい書類を検知しました',
                    body: `${fileName} を待機リストに追加しました。`,
                }).show();

                mainWindow.webContents.send('update-file-list', pendingFiles);
            }
        }
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

            const newQuote = quoteResponse.data;

            // 3. ファイルアップロード
            if (newQuote && newQuote.id) {
                const uploadFormData = new FormData();
                uploadFormData.append('quotationId', newQuote.id);
                uploadFormData.append('files', fs.createReadStream(file.path));

                await axios.post(`${apiBaseUrl}/api/files/upload`, uploadFormData, {
                    headers: {
                        ...uploadFormData.getHeaders(),
                        'Authorization': `Bearer ${authToken}`,
                        'X-Client-Type': 'hotfolder'
                    }
                });
            }

            // 4. 後処理（移動）
            const processedPath = path.join(watchFolder, 'processed', file.name);
            fs.renameSync(file.path, processedPath);

            file.status = 'completed';
            file.path = processedPath; // 移動後のパスに更新
        } catch (err) {
            console.error(`Error processing ${file.name}:`, err.response?.data || err.message);
            file.status = 'error';
            file.errorMessage = err.response?.data?.error || err.message;
        }

        mainWindow.webContents.send('update-file-list', pendingFiles);
    }

    new Notification({
        title: '一括解析完了',
        body: '選択されたファイルの処理が終了しました。',
    }).show();
});
