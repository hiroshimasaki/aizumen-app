/**
 * 金額文字列をパースして数値に変換
 * 全角数字、カンマ、円記号等を処理
 */
function parsePrice(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;

    const str = String(val)
        .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .replace(/[¥￥,、円]/g, '')
        .trim();

    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

/**
 * 見積IDを生成 (QYYMMDD-XXX 形式)
 * 同日内で連番を振る
 */
async function generateQuotationId(supabase, tenantId) {
    try {
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const prefix = `Q${yy}${mm}${dd}`;

        // 同日の最大IDを取得
        const { data, error } = await supabase
            .from('quotations')
            .select('display_id')
            .eq('tenant_id', tenantId)
            .like('display_id', `${prefix}-%`)
            .order('display_id', { ascending: false })
            .limit(1);

        if (error) {
            console.error('[Helper] Failed to fetch last display_id:', error);
            // エラー時はフォールバックとして現在のユニークさを保つために QYYMMDD-001 などから開始することを許容（重複エラーはDB側で防ぐ）
            return `${prefix}-001`;
        }

        let seq = 1;
        if (data && data.length > 0) {
            // `Q260303-001` のハイフン以降の数値を取得
            const parts = data[0].display_id.split('-');
            if (parts.length > 1) {
                const lastSeq = parseInt(parts[parts.length - 1], 10);
                if (!isNaN(lastSeq)) seq = lastSeq + 1;
            }
        }

        return `${prefix}-${String(seq).padStart(3, '0')}`;
    } catch (err) {
        console.error('[Helper] Exception in generateQuotationId:', err);
        const prefix = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        return `Q${prefix}-ERR`;
    }
}

/**
 * 検索ワードを正規化する
 * - 全角英数字、記号を半角に変換
 * - ハイフン、長音記号等の正規化
 * - 小文字化
 * - トリム、複数スペースの集約
 */
function normalizeSearchTerm(term) {
    if (!term) return '';

    return term
        // 全角英数字・記号を半角に変換
        .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        // 特殊なハイフンやダッシュを標準的なハイフンに統一（長音記号「ー」は除外）
        .replace(/[‐－―]/g, '-')
        .toLowerCase()
        .trim();
}

module.exports = { parsePrice, generateQuotationId, normalizeSearchTerm };
