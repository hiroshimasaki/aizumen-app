require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const logService = require('./services/logService');

// Route imports
const authRoutes = require('./routes/auth');
const quotationRoutes = require('./routes/quotations');
const companyRoutes = require('./routes/companies');
const fileRoutes = require('./routes/files');
const ocrRoutes = require('./routes/ocr');
const settingsRoutes = require('./routes/settings');
const subscriptionRoutes = require('./routes/subscription');
const userRoutes = require('./routes/users');
const webhookRoutes = require('./routes/webhook');
const creditsRoutes = require('./routes/credits');
const importRoutes = require('./routes/import');
const backupRoutes = require('./routes/backups');
const exportRoutes = require('./routes/export');
const superAdminRoutes = require('./routes/superAdmin');

// Middleware imports
const { errorHandler } = require('./middleware/errorHandler');
const { checkTenant } = require('./middleware/auth');
const accessLogMiddleware = require('./middleware/accessLog');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Rate Limiting ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 2000, // 開発・デバッグ用に緩和 (300 -> 2000)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  // ローカルホストからのリクエストは制限をスキップ
  skip: (req) => req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1',
});

const ocrLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分
  max: 10,
  message: { error: 'OCR rate limit exceeded. Please wait before retrying.' },
});

// --- Global Middleware ---
app.use(cors({
  origin: [process.env.APP_URL || 'http://localhost:5174', 'null', 'file://'],
  credentials: true,
}));

// --- Stripe Webhook (raw body が必要なので json パース前に登録) ---
app.use('/api/webhook', webhookRoutes);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(accessLogMiddleware); // ここに追加

app.use('/api/', apiLimiter);
app.use('/api/ocr/', ocrLimiter);

// --- Health Check ---
app.get('/api/health', async (req, res) => {
  try {
    const { supabaseAdmin } = require('./config/supabase');
    const { error } = await supabaseAdmin.from('tenants').select('id').limit(1);
    if (error) throw error;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      message: 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/import', importRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/credits', creditsRoutes);
app.use('/api/super-admin', superAdminRoutes);

// --- 404 Handler ---
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// --- Error Handler ---
app.use(errorHandler);

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`[AiZumen API] Server running on port ${PORT}`);
  console.log(`[AiZumen API] Environment: ${process.env.NODE_ENV || 'development'}`);

  const cron = require('node-cron');
  const { supabaseAdmin } = require('./config/supabase');
  const backupService = require('./services/backupService');

  // 毎日 AM2:00 にDBのJSONバックアップを実行
  cron.schedule('0 2 * * *', async () => {
    console.log('[Cron] Starting daily backup job...');
    await backupService.runDailyBackup();
  }, {
    timezone: 'Asia/Tokyo'
  });

  // 毎日 AM3:00 にゴミ箱の自動パージを実行
  cron.schedule('0 3 * * *', async () => {
    const RETENTION_DAYS = 30;
    console.log(`[Cron] Starting trash purge (items older than ${RETENTION_DAYS} days)...`);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
      const cutoffISO = cutoffDate.toISOString();

      // 対象の案件を取得
      const { data: targets, error: fetchError } = await supabaseAdmin
        .from('quotations')
        .select('id, company_name, deleted_at')
        .eq('is_deleted', true)
        .lt('deleted_at', cutoffISO);

      if (fetchError) {
        console.error('[Cron] Fetch error:', fetchError.message);
        return;
      }

      if (!targets || targets.length === 0) {
        console.log('[Cron] No expired trash items. Done.');
        return;
      }

      console.log(`[Cron] Found ${targets.length} items to purge.`);

      for (const target of targets) {
        try {
          // Storage上のファイルも削除
          const { data: files } = await supabaseAdmin
            .from('quotation_files')
            .select('storage_path')
            .eq('quotation_id', target.id);

          if (files && files.length > 0) {
            const paths = files.map(f => f.storage_path).filter(Boolean);
            if (paths.length > 0) {
              await supabaseAdmin.storage.from('quotation-files').remove(paths);
            }
          }

          // CASCADE DELETEにより子テーブル（items, files, history）も自動削除
          await supabaseAdmin.from('quotations').delete().eq('id', target.id);
          console.log(`[Cron] Purged: ${target.id} (${target.company_name || 'N/A'})`);
        } catch (err) {
          console.error(`[Cron] Error purging ${target.id}:`, err.message);
        }
      }

      console.log('[Cron] Trash purge completed.');
    } catch (err) {
      console.error('[Cron] Unexpected error:', err.message);
    }
  }, {
    timezone: 'Asia/Tokyo'
  });

  console.log('[AiZumen API] Cron job registered: trash purge at 03:00 JST daily');
});

// グローバルエラー捕捉
process.on('uncaughtException', async (err) => {
  console.error('[AiZumen API] Uncaught Exception:', err);
  await logService.error(err, { source: 'server_global_uncaught' });
  // 本来はプロセスを再起動すべきだが、一旦記録のみ
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('[AiZumen API] Unhandled Rejection at:', promise, 'reason:', reason);
  await logService.error(reason instanceof Error ? reason : new Error(String(reason)), {
    source: 'server_global_rejection'
  });
});

module.exports = app;
