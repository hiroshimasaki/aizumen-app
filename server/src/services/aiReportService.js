const { supabaseAdmin } = require('../config/supabase');
const aiService = require('./aiService');
const logService = require('./logService');

/**
 * AI Monthly Report Service
 * Monthly analysis generation (Pro Plan only).
 */
class AIReportService {
    /**
     * Run monthly report generation for all Pro tenants
     */
    async generateAllMonthlyReports() {
        console.log('[AIReportService] Starting monthly report generation...');
        const now = new Date();
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const targetMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

        // Get all Pro tenants
        const { data: tenants, error: tenantsError } = await supabaseAdmin
            .from('tenants')
            .select('id, name')
            .eq('plan', 'pro');

        if (tenantsError) {
            console.error('[AIReportService] Failed to fetch pro tenants:', tenantsError);
            return;
        }

        console.log(`[AIReportService] Found ${tenants.length} pro tenants for ${targetMonth}`);

        for (const tenant of tenants) {
            try {
                await this.generateReportForTenant(tenant.id, tenant.name, targetMonth);
            } catch (err) {
                console.error(`[AIReportService] Failed report for tenant ${tenant.name} (${tenant.id}):`, err);
            }
        }
    }

    /**
     * Generate and save report for a single tenant
     */
    async generateReportForTenant(tenantId, tenantName, targetMonth) {
        console.log(`[AIReportService] Generating report for ${tenantName} (${targetMonth})...`);

        // 1. Data Collection
        const stats = await this.collectTenantStats(tenantId, targetMonth);
        if (stats.totalCount === 0) {
            console.log(`[AIReportService] No data for ${tenantName} in ${targetMonth}. Skipping.`);
            return;
        }

        // 2. AI Prompt Engineering
        const prompt = this.buildPrompt(tenantName, targetMonth, stats);

        // 3. AI Generation (Gemini 1.5 Flash)
        const content = await aiService.generateText(prompt, null, null);

        // 4. Save to Database
        const { error: upsertError } = await supabaseAdmin
            .from('ai_monthly_reports')
            .upsert({
                tenant_id: tenantId,
                target_month: targetMonth,
                content: content,
                metrics_summary: stats
            }, { onConflict: 'tenant_id, target_month' });

        if (upsertError) throw upsertError;

        console.log(`[AIReportService] Successfully saved report for ${tenantName}`);
    }

    /**
     * Collect stats for a tenant for a specific month
     */
    async collectTenantStats(tenantId, targetMonth) {
        const [year, month] = targetMonth.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1).toISOString();
        const endDate = new Date(year, month, 1).toISOString();

        // 1. Fetch quotations CREATED in target month (for Win Rate)
        const { data: createdQ, error: createdError } = await supabaseAdmin
            .from('quotations')
            .select('*, items:quotation_items(*)')
            .eq('tenant_id', tenantId)
            .gte('created_at', startDate)
            .lt('created_at', endDate);

        if (createdError) throw createdError;

        // 2. Fetch quotations that have items with delivery_date in target month (for Actuals)
        // Note: We use a join or fetch both to be safe. 
        // For simplicity and accuracy, we'll fetch quotes that were UPDATED recently or have items in the month.
        const { data: deliveredQ, error: deliveredError } = await supabaseAdmin
            .from('quotations')
            .select('*, items:quotation_items(*)')
            .eq('tenant_id', tenantId)
            .or(`status.eq.delivered,status.eq.ordered`)
            .filter('items.delivery_date', 'gte', startDate)
            .filter('items.delivery_date', 'lt', endDate);

        if (deliveredError) throw deliveredError;

        // Combine unique quotations
        const quoteMap = new Map();
        (createdQ || []).forEach(q => quoteMap.set(q.id, q));
        (deliveredQ || []).forEach(q => quoteMap.set(q.id, q));
        
        const allQuotations = Array.from(quoteMap.values());

        // Stats calculation
        const totalCount = (createdQ || []).length; // Base for Win Rate
        const orderedInMonth = (createdQ || []).filter(q => ['ordered', 'delivered'].includes(q.status));
        const orderCount = orderedInMonth.length;
        const winRate = totalCount > 0 ? Math.round((orderCount / totalCount) * 100) : 0;

        let totalRevenue = 0;
        let totalEstProcCost = 0;
        let totalActProcCost = 0;
        let itemsWithActuals = 0;
        let totalItemsInTarget = 0;

        allQuotations.forEach(q => {
            (q.items || []).forEach(item => {
                // Check if this specific item belongs to the target month's work
                // Either it was created this month OR it was delivered this month
                const itemCreated = q.created_at >= startDate && q.created_at < endDate;
                const itemDelivered = item.delivery_date >= startDate && item.delivery_date < endDate;

                if (itemCreated || itemDelivered) {
                    if (['ordered', 'delivered'].includes(q.status)) {
                        totalItemsInTarget++;
                        const qty = Number(item.quantity) || 1;
                        const p = (Number(item.processing_cost) || 0) * qty;
                        const m = (Number(item.material_cost) || 0) * qty;
                        const o = (Number(item.other_cost) || 0) * qty;
                        
                        totalRevenue += (p + m + o);
                        totalEstProcCost += p;

                        if (Number(item.actual_processing_cost) > 0 || Number(item.actual_hours) > 0) {
                            let act = Number(item.actual_processing_cost) || 0;
                            if (act <= 0 && Number(item.actual_hours) > 0) {
                                act = Number(item.actual_hours) * 8000;
                            }
                            totalActProcCost += (act * qty);
                            itemsWithActuals++;
                        }
                    }
                }
            });
        });

        const actualInputRate = totalItemsInTarget > 0 ? Math.round((itemsWithActuals / totalItemsInTarget) * 100) : 0;
        const grossMargin = totalEstProcCost - totalActProcCost;
        const marginPct = totalEstProcCost > 0 ? Math.round((grossMargin / totalEstProcCost) * 100) : 0;

        return {
            targetMonth,
            totalCount,
            orderCount,
            winRate,
            totalRevenue: Math.round(totalRevenue),
            totalEstProcCost: Math.round(totalEstProcCost),
            totalActProcCost: Math.round(totalActProcCost),
            marginPct,
            actualInputRate,
            totalItems: totalItemsInTarget
        };
    }

    buildPrompt(tenantName, targetMonth, stats) {
        const [year, month] = targetMonth.split('-');
        return `
あなたは製造業に特化した経験豊富な経営コンサルタントであり、同時に現場の阿吽の呼吸を理解する熟練の工場長（現場監督）でもあります。
${tenantName} 様の ${year}年${month}月 の実績データに基づき、経営的な視点と現場へのアドバイスを組み合わせた「月次総評レポート」を作成してください。

### 【実績データ】
- 対象月: ${year}年${month}月
- 見積件数: ${stats.totalCount} 件
- 受注件数: ${stats.orderCount} 件 (受注率: ${stats.winRate}%)
- 総売上: ${stats.totalRevenue.toLocaleString()} 円
- 加工費(予定): ${stats.totalEstProcCost.toLocaleString()} 円
- 加工費(実績): ${stats.totalActProcCost.toLocaleString()} 円
- 加工粗利率: ${stats.marginPct}%
- 実績入力率: ${stats.actualInputRate}% (全 ${stats.totalItems} 明細中)

### 【レポート構成ルール】
1. **経営総評**: 売上と受注率から見た現状分析と、利益率改善に向けた戦略的なアドバイス。
2. **現場へのフィードバック**: 特に「実績入力率」に着目し、現場が入力を行うメリットや改善すべき点。
3. **来月への提言**: 具体的な数値改善のためのTODO。
4. **口調**: 熱意やパッションではなく、論理的で冷静なトーン。

### 【制約】
- 出力は日本語のマークダウン形式のみ。
- 派手なロゴや説明は不要。内容に集中すること。
- 日本の製造業（町工場・加工会社）のコンテキストを考慮すること。
- 実績入力率が低い（80%未満）場合は、現場への入力督促を明確に含めること。
- データが少ない場合でも、そのデータをどう解釈すべきかを含めること。
`;
    }
}

module.exports = new AIReportService();
