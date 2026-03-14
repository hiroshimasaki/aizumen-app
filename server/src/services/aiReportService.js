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

        // Fetch quotations and items
        const { data: qData, error: qError } = await supabaseAdmin
            .from('quotations')
            .select('*, items:quotation_items(*)')
            .eq('tenant_id', tenantId)
            .gte('created_at', startDate)
            .lt('created_at', endDate);

        if (qError) throw qError;

        const quotations = qData || [];
        const totalCount = quotations.length;
        const ordered = quotations.filter(q => ['ordered', 'delivered'].includes(q.status));
        const orderCount = ordered.length;
        const winRate = totalCount > 0 ? Math.round((orderCount / totalCount) * 100) : 0;

        let totalRevenue = 0;
        let totalEstProcCost = 0;
        let totalActProcCost = 0;
        let itemsWithActuals = 0;
        let totalItems = 0;

        ordered.forEach(q => {
            (q.items || []).forEach(item => {
                totalItems++;
                const qty = Number(item.quantity) || 1;
                const p = (Number(item.processingCost) || 0) * qty;
                const m = (Number(item.materialCost) || 0) * qty;
                const o = (Number(item.otherCost) || 0) * qty;
                totalRevenue += (p + m + o);
                totalEstProcCost += p;

                if (item.actualProcessingCost || item.actualHours) {
                    let act = Number(item.actualProcessingCost) || 0;
                    if (act <= 0 && Number(item.actualHours) > 0) {
                        act = Number(item.actualHours) * 8000; // Default rate
                    }
                    totalActProcCost += (act * qty);
                    itemsWithActuals++;
                }
            });
        });

        const actualInputRate = totalItems > 0 ? Math.round((itemsWithActuals / totalItems) * 100) : 0;
        const grossMargin = totalEstProcCost - totalActProcCost;
        const marginPct = totalEstProcCost > 0 ? Math.round((grossMargin / totalEstProcCost) * 100) : 0;

        return {
            targetMonth,
            totalCount,
            orderCount,
            winRate,
            totalRevenue,
            totalEstProcCost,
            totalActProcCost,
            marginPct,
            actualInputRate,
            totalItems
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
4. **口調**: 丁寧ながらも、製造業の熱意が伝わるプロフェッショナルなトーン。

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
