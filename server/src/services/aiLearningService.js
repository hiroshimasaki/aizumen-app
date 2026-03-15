const { supabaseAdmin } = require('../config/supabase');

class AILearningService {
    /**
     * AI解析結果とユーザーの修正内容を比較し、学習用ヒントを生成・保存する
     */
    async learnFromCorrection(tenantId, originalResult, finalData) {
        try {
            if (!originalResult || !finalData) return;

            const hints = [];

            // 1. 会社名の学習
            if (originalResult.companyName !== finalData.companyName && finalData.companyName) {
                hints.push(`この書類の会社名は「${finalData.companyName}」として抽出してください。以前は「${originalResult.companyName}」と誤認していました。`);
            }

            // 2. 明細項目の不足・修正の学習 (簡易版: 数が一致する場合のみ項目名ベースで比較)
            const oldItems = originalResult.items || [];
            const newItems = finalData.items || [];

            if (oldItems.length === newItems.length) {
                newItems.forEach((newItem, idx) => {
                    const oldItem = oldItems[idx];
                    if (!oldItem) return;

                    // 品名の修正
                    if (oldItem.name !== newItem.name && newItem.name) {
                        hints.push(`品名「${oldItem.name}」は正しくありません。正しくは「${newItem.name}」です。`);
                    }

                    // 金額のマッピング漏れ（AIが0だったがユーザーが入力した）
                    if (Number(oldItem.processingCost || 0) === 0 && Number(newItem.processingCost || 0) > 0) {
                        hints.push(`品名「${newItem.name}」に関連する数値は加工費 (processingCost) として抽出してください。`);
                    }
                });
            }

            if (hints.length === 0) return;

            // テナント設定を更新してヒントを蓄積
            await this._saveHints(tenantId, hints);

        } catch (error) {
            console.error('[AILearningService] Learning failed:', error);
        }
    }

    /**
     * 学習ヒントをDBに保存（重複排除と件数制限）
     */
    async _saveHints(tenantId, newHints) {
        const { data: settings, error: fetchError } = await supabaseAdmin
            .from('tenant_settings')
            .select('settings_json')
            .eq('tenant_id', tenantId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') return;

        const settingsJson = settings?.settings_json || {};
        const existingHints = settingsJson.ai_learning_hints || [];

        // 重複を除外しつつ追加 (最新のものを優先)
        let updatedHints = [...new Set([...newHints, ...existingHints])];
        
        // 50件制限（プロンプトが巨大化するのを防ぐ）
        if (updatedHints.length > 50) {
            updatedHints = updatedHints.slice(0, 50);
        }

        settingsJson.ai_learning_hints = updatedHints;

        await supabaseAdmin
            .from('tenant_settings')
            .upsert({
                tenant_id: tenantId,
                settings_json: settingsJson,
                updated_at: new Date().toISOString()
            });
    }
}

module.exports = new AILearningService();
