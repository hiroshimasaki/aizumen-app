const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const { supabaseAdmin } = require('../config/supabase');

/**
 * GET /api/health/ai
 * AIサービスの稼働状況と環境設定の診断
 */
router.get('/ai', async (req, res) => {
    try {
        const aiStatus = aiService.getStatus();
        
        // 実際の疎通テストを追加
        console.log('[Health] Running AI connectivity test...');
        const aiTest = await aiService.testAI();
        
        // データベース接続テスト
        const { data, error: dbError } = await supabaseAdmin.from('tenants').select('id').limit(1);
        
        res.json({
            status: aiStatus.initialized && aiTest.status === 'ok' ? 'ok' : 'error',
            timestamp: new Date().toISOString(),
            ai: {
                ...aiStatus,
                test: aiTest
            },
            database: {
                connected: !dbError,
                error: dbError ? dbError.message : null
            },
            env: {
                NODE_ENV: process.env.NODE_ENV,
                RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT || 'unknown'
            }
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
