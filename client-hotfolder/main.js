const { app, BrowserWindow, ipcMain, dialog, Notification, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const chokidar = require('chokidar');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const notifier = require('node-notifier');
const { PDFDocument } = require('pdf-lib');

let mainWindow;
let watcher;
let pendingFiles = [];
let authToken = null;
const apiBaseUrl = 'https://aizumen-production.up.railway.app';
let watchFolder = null;
let tray = null; // トレイアイコン用
let minimizeOnClose = true; // 閉じるボタンで最小化するかどうか
let autoAnalysis = false; // 自動解析モード

if (app) {
    app.isQuiting = false; // 終了フラグの初期化
}

const getConfigPath = () => path.join(app.getPath('userData'), 'hotfolder-config.json');

function loadConfig() {
    try {
        if (fs.existsSync(getConfigPath())) {
            const config = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
            if (config.minimizeOnClose !== undefined) {
                minimizeOnClose = config.minimizeOnClose;
            }
            if (config.autoAnalysis !== undefined) {
                autoAnalysis = config.autoAnalysis;
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
    // mainWindow.webContents.openDevTools(); // デバッグ用に自動で開く

    // システムトレイの設定
    const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);

    const contextMenu = Menu.buildFromTemplate([
        { label: 'アプリを開く', click: () => mainWindow.show() },
        { type: 'separator' },
        {
            label: '終了', click: () => {
                app.isQuiting = true;
                app.quit();
            }
        }
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

function logToRenderer(message, data = null) {
    if (mainWindow && mainWindow.webContents) {
        const timestamp = new Date().toLocaleTimeString();
        mainWindow.webContents.send('main-log', { message: `[${timestamp}] ${message}`, data });
    }
}

// IPC Handlers
ipcMain.on('update-minimize-config', (event, value) => {
    minimizeOnClose = value;
});

ipcMain.on('update-auto-analysis-config', (event, value) => {
    logToRenderer(`Auto Analysis Toggle: ${value}`);
    autoAnalysis = value;
    if (autoAnalysis) {
        startAutoAnalysisIfPossible();
    }
});

async function startAutoAnalysisIfPossible() {
    const statusInfo = `autoAnalysis=${autoAnalysis}, isLoggedIn=${isLoggedIn}, hasToken=${!!authToken}, pendingCount=${pendingFiles.length}`;
    logToRenderer(`Auto-analysis check: ${statusInfo}`);
    
    if (!autoAnalysis || !isLoggedIn || !authToken) {
        logToRenderer(`Skipping auto-analysis because criteria not met.`);
        return;
    }
    
    const filesToProcess = pendingFiles.filter(f => f.status === 'detected');
    logToRenderer(`Found ${filesToProcess.length} files to auto-process.`);
    
    for (const file of filesToProcess) {
        await processFile(file);
    }
}

/**
 * 通信リトライ用のラッパー関数
 */
async function withRetry(fn, maxRetries = 3, initialDelay = 1000) {
    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            const status = err.response?.status;
            const isRateLimit = status === 429;
            const isNetworkError = !status || status >= 500 || err.code === 'ECONNRESET';
            
            if (i < maxRetries && (isRateLimit || isNetworkError)) {
                const delay = isRateLimit ? 5000 : initialDelay * Math.pow(2, i);
                logToRenderer(`リクエスト再試行 (${i + 1}/${maxRetries}) ${delay}ms後... (Error: ${err.message})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw err;
        }
    }
}

/**
 * リストのクリーンアップ（完了済みを非表示にする等）
 */
function cleanupPendingFiles() {
    // 完了から一定以上の件数を超えたら古い完了済みから削除する
    if (pendingFiles.length > 50) {
        const completed = pendingFiles.filter(f => f.status === 'completed');
        if (completed.length > 10) {
            const toKeepPaths = new Set(pendingFiles.filter(f => f.status !== 'completed').map(f => f.path));
            // 完了済みの新しい方10件は残す
            const completedToKeep = completed.slice(-10).map(f => f.path);
            completedToKeep.forEach(p => toKeepPaths.add(p));
            
            pendingFiles = pendingFiles.filter(f => toKeepPaths.has(f.path));
        }
    }
}

/**
 * PDFを指定されたページで分割し、Bufferとして返す
 * @param {Buffer} originalBuffer 元のPDFデータのBuffer
 * @param {number[]} pageNumbers 抽出するページ番号の配列 (1-indexed)
 * @returns {Promise<Buffer|null>} 抽出後のPDFデータのBuffer
 */
async function splitPdfBuffer(originalBuffer, pageNumbers) {
    if (!pageNumbers || pageNumbers.length === 0) return null;
    try {
        const pdfDoc = await PDFDocument.load(originalBuffer);
        const newPdfDoc = await PDFDocument.create();

        // ページ番号を 0-indexed に変換し、存在するページのみ追加
        const indices = pageNumbers
            .map(n => n - 1)
            .filter(i => i >= 0 && i < pdfDoc.getPageCount());

        if (indices.length === 0) return null;

        const copiedPages = await newPdfDoc.copyPages(pdfDoc, indices);
        copiedPages.forEach((page) => newPdfDoc.addPage(page));

        const pdfBytes = await newPdfDoc.save();
        return Buffer.from(pdfBytes);
    } catch (err) {
        logToRenderer(`[PDF Split Error] ${err.message}`);
        return null;
    }
}

async function processFile(file) {
    try {
        logToRenderer(`Starting analysis for ${file.name}`);
        file.status = 'processing';
        mainWindow.webContents.send('update-file-list', pendingFiles);

        // 処理間のウェイト（レートリミット対策 2秒）
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 1. OCR解析
        const formData = new FormData();
        formData.append('file', fs.createReadStream(file.path));

        const ocrResponse = await withRetry(() => axios.post(`${apiBaseUrl}/api/ocr/analyze`, formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${authToken}`,
                'X-Client-Type': 'hotfolder'
            },
            timeout: 180000 // 解析は時間がかかるため3分
        }));

        const ocrData = ocrResponse.data;

        // 1.5 重複チェック (注文番号)
        if (ocrData.orderNumber && ocrData.orderNumber.trim()) {
            const orderNum = ocrData.orderNumber.trim();
            logToRenderer(`Checking for duplicates: ${orderNum}`);
            try {
                const dupResponse = await withRetry(() => axios.get(`${apiBaseUrl}/api/quotations/check-duplicate`, {
                    params: { orderNumber: orderNum },
                    headers: { 'Authorization': `Bearer ${authToken}` }
                }));
                if (dupResponse.data && dupResponse.data.duplicate) {
                    const match = dupResponse.data.matches?.[0];
                    throw new Error(`[重複エラー] 注文番号 ${orderNum} は既に登録されています (ID: ${match?.displayId || '不明'})。`);
                }
            } catch (dupErr) {
                if (dupErr.message.includes('[重複エラー]')) throw dupErr;
                // 重複チェック自体が失敗した場合は、二重登録を防ぐためエラーとして扱う
                throw new Error(`[重複チェック失敗] サーバーとの通信に失敗しました。二重登録防止のため停止します。`);
            }
        }

        // 2. 案件登録
        const items = (ocrData.items && ocrData.items.length > 0)
            ? ocrData.items.map(aiItem => ({
                name: aiItem.name || file.name.split('.')[0],
                quantity: aiItem.quantity || 1,
                processingCost: aiItem.processingCost || 0,
                materialCost: aiItem.materialCost || 0,
                otherCost: aiItem.otherCost || 0,
                dueDate: aiItem.dueDate || '',
                dimensions: aiItem.dimensions || '',
                material: aiItem.material || '',
                processingMethod: aiItem.processingMethod || '',
                surface_treatment: aiItem.surface_treatment || aiItem.surfaceTreatment || '',
                requiresVerification: aiItem.requiresVerification || false
            }))
            : [{
                name: file.name.split('.')[0],
                quantity: 1,
                processingCost: 0,
                materialCost: 0,
                otherCost: 0,
                dueDate: '',
                dimensions: '',
                material: '',
                processingMethod: '',
                surfaceTreatment: '',
                requiresVerification: false
            }];

        const quotationPayload = {
            companyName: ocrData.companyName || '自動作成（ホットフォルダ）',
            orderNumber: (ocrData.orderNumber || '').trim(),
            constructionNumber: (ocrData.constructionNumber || '').trim(),
            status: 'ordered',
            isVerified: false, // キー名を isVerified に修正
            notes: ocrData.notes || 'ホットフォルダから自動投入',
            systemNotes: ocrData.systemNotes || '', // システム備考を追加
            items: items
        };
        logToRenderer(`Sending Quotation Payload for ${file.name}`, quotationPayload);

        const quoteResponse = await withRetry(() => axios.post(`${apiBaseUrl}/api/quotations`, quotationPayload, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'X-Client-Type': 'hotfolder'
            }
        }));

        const newQuote = quoteResponse.data;

        // 3. ファイルアップロード
        if (newQuote && newQuote.id) {
            const uploadFormData = new FormData();
            uploadFormData.append('quotationId', newQuote.id);

            const fileBuffer = fs.readFileSync(file.path);
            let uploadedCount = 0;

            // PDF かつ ページ詳細がある場合は分割を試みる
            if (ocrData.pageClassifications && file.name.toLowerCase().endsWith('.pdf')) {
                logToRenderer(`Attempting to split PDF based on AI classification...`);
                const orderFormPages = ocrData.pageClassifications.filter(p => p.type === 'order_form').map(p => p.page);
                const drawingPages = ocrData.pageClassifications.filter(p => p.type === 'drawing').map(p => p.page);

                const suffix = ocrData.orderNumber ? `_${ocrData.orderNumber.trim()}` : '';

                if (orderFormPages.length > 0) {
                    const buffer = await splitPdfBuffer(fileBuffer, orderFormPages);
                    if (buffer) {
                        uploadFormData.append('files', buffer, { filename: `注文書${suffix}.pdf`, contentType: 'application/pdf' });
                        uploadedCount++;
                    }
                }
                if (drawingPages.length > 0) {
                    const buffer = await splitPdfBuffer(fileBuffer, drawingPages);
                    if (buffer) {
                        uploadFormData.append('files', buffer, { filename: `図面${suffix}.pdf`, contentType: 'application/pdf' });
                        uploadedCount++;
                    }
                }
            }

            if (uploadedCount === 0) {
                uploadFormData.append('files', fs.createReadStream(file.path));
            }

            await withRetry(() => axios.post(`${apiBaseUrl}/api/files/upload`, uploadFormData, {
                headers: {
                    ...uploadFormData.getHeaders(),
                    'Authorization': `Bearer ${authToken}`,
                    'X-Client-Type': 'hotfolder'
                }
            }));
        }

        // 4. 後処理（移動）
        const processedPath = path.join(watchFolder, 'processed', file.name);
        fs.renameSync(file.path, processedPath);
        file.path = processedPath;

        file.status = 'completed';
        delete file.errorMessage;
        cleanupPendingFiles(); // 定期クリーンアップ
    } catch (err) {
        console.error(`Error processing ${file.name}:`, err.message);
        file.status = 'error';
        file.errorMessage = err.message;
        logToRenderer(`Error processing ${file.name}`, { 
            message: err.message
        });
    } finally {
        mainWindow.webContents.send('update-file-list', pendingFiles);
    }
}

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
    },
    {
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
        ]
    }
];
const menu = Menu.buildFromTemplate(menuTemplate);
Menu.setApplicationMenu(menu);

// 終了フラグの管理
app.on('before-quit', () => {
    app.isQuiting = true;
});

app.on('will-quit', () => {
    // 終了時のクリーンアップ
    if (watcher) {
        watcher.close().then(() => console.log('Watcher closed'));
    }
    if (tray) {
        tray.destroy();
    }
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
    logToRenderer('Login success received in Main process.');
    authToken = token;
    isLoggedIn = true;
    startAutoAnalysisIfPossible();
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

    logToRenderer(`Starting watcher for: ${watchFolder}`);
    
    let isReady = false;
    watcher = chokidar.watch(watchFolder, {
        ignored: [/(^|[\/\\])\../, processedDir], // . で始まるファイルと processed フォルダを無視
        persistent: true,
        depth: 0, // 直下のファイルのみ
        usePolling: true, // ネットワークドライブ対応
        interval: 1000, // ポーリング間隔
    });

    watcher.on('add', (filePath) => {
        if (path.extname(filePath).toLowerCase() === '.pdf') {
            const fileName = path.basename(filePath);
            // すでにリストにないかチェック
            if (!pendingFiles.some(f => f.path === filePath)) {
                const newFile = { name: fileName, path: filePath, status: 'detected' };
                pendingFiles.push(newFile);

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
                    
                    // 自動解析モードがONかつログイン中かつトークンがある場合、即座に解析開始
                    if (autoAnalysis && isLoggedIn && authToken) {
                        processFile(newFile);
                    }
                }
            }
        }
    });

    watcher.on('ready', () => {
        isReady = true;
        // 初期スキャン完了後に一括送信
        mainWindow.webContents.send('update-file-list', pendingFiles);
        // 自動解析がONなら開始
        startAutoAnalysisIfPossible();
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
        await processFile(file);
    }

    new Notification({
        title: '一括解析完了',
        body: '選択されたファイルの処理が終了しました。',
    }).show();
});
