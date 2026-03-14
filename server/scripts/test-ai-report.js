/**
 * AI Monthly Report Manual Test Script
 * Usage: node scripts/test-ai-report.js [tenantId] [YYYY-MM]
 */
require('dotenv').config();
const aiReportService = require('../src/services/aiReportService');
const { supabaseAdmin } = require('../src/config/supabase');

async function run() {
    let tenantId = process.argv[2];
    const targetMonth = process.argv[3];

    // Clean tenantId if it contains brackets, quotes or whitespace
    if (tenantId) {
        tenantId = tenantId.replace(/[\[\]'"]/g, '').trim();
    }

    if (!tenantId || !targetMonth) {
        console.log('Usage: node scripts/test-ai-report.js <tenantId> <YYYY-MM>');
        console.log('Example: node scripts/test-ai-report.js 12345678-1234-1234-1234-1234567890ab 2024-02');
        
        // テナント一覧を表示して補助する
        const { data: tenants } = await supabaseAdmin.from('tenants').select('id, name, plan');
        console.log('\nAvailable Tenants:');
        tenants.forEach(t => console.group(`- ${t.name} (${t.plan}): ${t.id}`));
        process.exit(1);
    }

    try {
        console.log(`\n[Test] Generating report for Tenant: ${tenantId}, Month: ${targetMonth}...`);
        
        const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('name')
            .eq('id', tenantId)
            .single();

        if (!tenant) throw new Error('Tenant not found');

        await aiReportService.generateReportForTenant(tenantId, tenant.name, targetMonth);
        
        console.log('\n[Success] Report generated and saved to database.');
        console.log('You can now check it in the "Data Analysis" tab on the frontend.');
        process.exit(0);
    } catch (err) {
        console.error('\n[Error] Generation failed:', err);
        process.exit(1);
    }
}

run();
