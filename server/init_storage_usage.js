require('dotenv').config();
const storageService = require('./src/services/storageService');

async function initialize() {
    console.log('[Initialize] Starting initial storage usage calculation for ALL tenants...');
    try {
        await storageService.updateAllTenantsUsage();
        console.log('[Initialize] Successfully updated all tenants usage.');
        process.exit(0);
    } catch (err) {
        console.error('[Initialize] Failed to update usage:', err);
        process.exit(1);
    }
}

initialize();
