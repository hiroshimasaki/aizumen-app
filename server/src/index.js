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
const forumRoutes = require('./routes/forum');
const searchRoutes = require('./routes/search');
const healthRoutes = require('./routes/health');
const materialPriceRoutes = require('./routes/materialPrices');
const analysisRoutes = require('./routes/analysis');


// Middleware imports
const { errorHandler } = require('./middleware/errorHandler');
const { checkTenant } = require('./middleware/auth');
const accessLogMiddleware = require('./middleware/accessLog');
const maintenanceMiddleware = require('./middleware/maintenance');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Proxy Trust (Railway/Load Balancers) ---
app.set('trust proxy', 1);

// --- Rate Limiting ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 300, // 本番用の制限に戻す (2000 -> 300)
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
  origin: [
    process.env.APP_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175'
  ],
  credentials: true,
}));

// --- Stripe Webhook (raw body が必要なので json パース前に登録) ---
app.use('/api/webhook', webhookRoutes);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(accessLogMiddleware); // ここに追加

app.use('/api/', apiLimiter);
app.use('/api/ocr/', ocrLimiter);

// --- Public System Status ---
app.get('/api/sys/status', async (req, res) => {
  try {
    const { supabaseAdmin } = require('./config/supabase');
    
    // 1. 環境変数とバイパスチェック (メンテナンスミドルウェアと同様のロジック)
    const isEnvMaintenance = process.env.MAINTENANCE_MODE === 'true';
    const bypassToken = process.env.MAINTENANCE_BYPASS_TOKEN;
    const clientBypassToken = req.headers['x-maintenance-bypass'];
    const isBypassActive = bypassToken && clientBypassToken === bypassToken;

    const { data } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'maintenance_mode')
      .maybeSingle();
    
    const settings = data?.value || { enabled: false, message: '' };
    
    // バイパスが有効な場合は、フロントエンドに「メンテナンス中ではない」と見せかけてリダイレクトを防ぐ
    const isMaintenance = (isEnvMaintenance || !!settings.enabled) && !isBypassActive;

    res.json({
      maintenance: isMaintenance,
      message: settings.message || (isEnvMaintenance ? '現在システムメンテナンス中です。サービス開始のめどが立ちましたらお知らせいたします。' : '')
    });
  } catch (err) {
    res.json({ maintenance: false, message: '' });
  }
});

app.use(maintenanceMiddleware); // 全APIに適用（authMiddlewareの前でも内部でパス除外される）

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
app.use('/api/forum', forumRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/material-prices', materialPriceRoutes);
app.use('/api/analysis', analysisRoutes);


// --- 404 Handler ---
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// --- Error Handler ---
app.use(errorHandler);

// --- Start Server ---
app.listen(PORT, '0.0.0.0', () => {
  const timestamp = new Date().toISOString();
  console.log(`[AiZumen API][${timestamp}] Server running on port ${PORT}`);
  console.log(`[AiZumen API][${timestamp}] Environment: ${process.env.NODE_ENV || 'development'}`);

  const cron = require('node-cron');
  const { supabaseAdmin } = require('./config/supabase');
  const backupService = require('./services/backupService');
  const aiReportService = require('./services/aiReportService');

  // 毎日 AM2:00 にDBのJSONバックアップを実行
  cron.schedule('0 2 * * *', async () => {
    console.log('[Cron] Starting daily backup job...');
    await backupService.runDailyBackup();
  }, {
    timezone: 'Asia/Tokyo'
  });

  // 毎月1日 AM1:00 にAI月次総評を生成 (Proプラン向け)
  cron.schedule('0 1 1 * *', async () => {
    console.log('[Cron] Starting monthly AI report generation...');
    await aiReportService.generateAllMonthlyReports();
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

  // 毎日 AM 4:00 に回答日超過による自動失注を実行
  cron.schedule('0 4 * * *', async () => {
    console.log('[Cron] Starting auto-lost status update job...');
    try {
      // 1. 自動失注設定が有効なテナントを取得
      const { data: tenants, error: tError } = await supabaseAdmin
        .from('tenants')
        .select('id, name, auto_lost_days');

      if (tError) throw tError;

      for (const tenant of tenants) {
        const autoLostDays = parseInt(tenant.auto_lost_days);
        if (!autoLostDays || autoLostDays <= 0) continue;

        console.log(`[Cron] Checking tenant: ${tenant.name} (Auto-lost: ${autoLostDays} days)`);

        // 2. 検討中かつ削除されていない案件を取得（明細も含む）
        const { data: quotations, error: qError } = await supabaseAdmin
          .from('quotations')
          .select('id, display_id, company_name, quotation_items(response_date)')
          .eq('tenant_id', tenant.id)
          .eq('status', 'pending')
          .eq('is_deleted', false);

        if (qError) {
          console.error(`[Cron] Error fetching quotations for ${tenant.name}:`, qError.message);
          continue;
        }

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        for (const quotation of quotations) {
          if (!quotation.quotation_items || quotation.quotation_items.length === 0) continue;

          // 明細の中で最も遅い回答日を探す
          const dates = quotation.quotation_items
            .map(item => item.response_date)
            .filter(Boolean)
            .map(d => new Date(d));

          if (dates.length === 0) continue;

          const latestResponseDate = new Date(Math.max(...dates));
          latestResponseDate.setHours(0, 0, 0, 0);

          // 経過日数を計算
          const diffTime = now.getTime() - latestResponseDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays >= autoLostDays) {
            console.log(`[Cron] Auto-lost: ${quotation.display_id} (Diff: ${diffDays} days)`);

            // ステータスを失注に更新
            const { error: updateError } = await supabaseAdmin
              .from('quotations')
              .update({ 
                status: 'lost',
                updated_at: new Date().toISOString()
              })
              .eq('id', quotation.id);

            if (!updateError) {
              // 履歴に記録
              await supabaseAdmin.from('quotation_history').insert({
                quotation_id: quotation.id,
                tenant_id: tenant.id,
                change_type: 'updated',
                changes: { 
                  'ステータス': { from: 'pending', to: 'lost' },
                  '注記': '回答日から一定期間経過したためシステムにより自動失注処理されました'
                }
              });

              await logService.audit({
                action: 'quotation_auto_lost',
                entityType: 'quotation',
                entityId: quotation.id,
                description: `自動失注処理: ${quotation.display_id} (${diffDays}日経過)`,
                tenantId: tenant.id,
                system: true
              });
            } else {
              console.error(`[Cron] Update failed for ${quotation.id}:`, updateError.message);
            }
          }
        }
      }
      console.log('[Cron] Auto-lost job completed.');
    } catch (err) {
      console.error('[Cron] Auto-lost job failed:', err.message);
    }
  }, {
    timezone: 'Asia/Tokyo'
  });

  console.log('[AiZumen API] Cron job registered: auto-lost at 04:00 JST daily');
});

// グローバルエラー捕捉
process.on('uncaughtException', async (err) => {
  console.error('[AiZumen API] Uncaught Exception:', err);
  try {
    await logService.error(err, { source: 'server_global_uncaught' });
  } catch (e) {
    console.error('Failed to log uncaught exception:', e);
  }
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('[AiZumen API] Unhandled Rejection at:', promise, 'reason:', reason);
  try {
    await logService.error(reason instanceof Error ? reason : new Error(String(reason)), {
      source: 'server_global_rejection'
    });
  } catch (e) {
    console.error('Failed to log unhandled rejection:', e);
  }
});

module.exports = app;

// Deployment Trigger: 2026-03-12 16:30

