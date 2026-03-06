const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { generateQuotationId } = require('../utils/helpers');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/**
 * POST /api/import/quotations
 * CSV/JSONファイルから案件データをインポート
 */
router.post('/quotations', authMiddleware, requireRole('system_admin'), upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'ファイルが添付されていません' });
        }

        const fileContent = req.file.buffer.toString('utf-8');
        const fileName = req.file.originalname.toLowerCase();
        let records = [];

        if (fileName.endsWith('.json')) {
            // JSONインポート
            const parsed = JSON.parse(fileContent);
            records = Array.isArray(parsed) ? parsed : [parsed];
        } else if (fileName.endsWith('.csv')) {
            // CSVインポート
            records = await parseCSV(fileContent);
        } else {
            return res.status(400).json({ message: 'CSVまたはJSONファイルのみ対応しています' });
        }

        // インポート実行
        const results = { success: 0, skipped: 0, errors: [] };

        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            try {
                const mapped = mapRecordToQuotation(record);

                // 重複チェック（注文番号）
                if (mapped.order_number) {
                    const { data: existing } = await supabaseAdmin
                        .from('quotations')
                        .select('id')
                        .eq('tenant_id', req.tenantId)
                        .eq('order_number', mapped.order_number)
                        .eq('is_deleted', false)
                        .maybeSingle();

                    if (existing) {
                        results.skipped++;
                        results.errors.push({ row: i + 1, reason: `注文番号 "${mapped.order_number}" は既に登録済みです` });
                        continue;
                    }
                }

                // 案件作成
                const displayId = mapped.display_id || await generateQuotationId(supabaseAdmin, req.tenantId);

                // 見積ID 重複チェック
                const { data: qExists } = await supabaseAdmin
                    .from('quotations')
                    .select('id')
                    .eq('tenant_id', req.tenantId)
                    .eq('display_id', displayId)
                    .eq('is_deleted', false)
                    .maybeSingle();

                if (qExists) {
                    results.skipped++;
                    results.errors.push({ row: i + 1, reason: `見積ID "${displayId}" は既に登録済みです` });
                    continue;
                }

                const { data: quotation, error: qError } = await supabaseAdmin
                    .from('quotations')
                    .insert({
                        display_id: displayId,
                        tenant_id: req.tenantId,
                        company_name: mapped.company_name || 'インポート案件',
                        contact_person: mapped.contact_person || '',
                        order_number: mapped.order_number || '',
                        construction_number: mapped.construction_number || '',
                        status: mapped.status || 'pending',
                        notes: mapped.notes || '',
                    })
                    .select()
                    .single();

                if (qError) throw qError;

                // 明細データがある場合
                if (mapped.items && mapped.items.length > 0) {
                    const items = mapped.items.map(item => ({
                        quotation_id: quotation.id,
                        name: item.name || '品名なし',
                        quantity: Number(item.quantity) || 1,
                        processing_cost: Number(item.processing_cost) || 0,
                        material_cost: Number(item.material_cost) || 0,
                        other_cost: Number(item.other_cost) || 0,
                    }));

                    await supabaseAdmin.from('quotation_items').insert(items);
                }

                results.success++;
            } catch (err) {
                results.errors.push({ row: i + 1, reason: err.message || '不明なエラー' });
            }
        }

        res.json({
            message: `インポート完了: ${results.success}件成功, ${results.skipped}件スキップ, ${results.errors.length - results.skipped}件エラー`,
            total: records.length,
            ...results,
        });
    } catch (err) {
        next(err);
    }
});

/**
 * CSVパース
 */
function parseCSV(content) {
    return new Promise((resolve, reject) => {
        const records = [];
        const stream = Readable.from([content]);
        stream
            .pipe(csv({
                mapHeaders: ({ header }) => header.trim(),
            }))
            .on('data', (row) => records.push(row))
            .on('end', () => resolve(records))
            .on('error', reject);
    });
}

/**
 * レコードを案件データにマッピング
 * JSON/CSV両方に対応（日本語ヘッダ・英語ヘッダ両方）
 */
function mapRecordToQuotation(record) {
    // フィールドマッピング（日本語 → DB列名）
    const fieldMap = {
        '会社名': 'company_name', 'company_name': 'company_name', 'companyName': 'company_name',
        '担当者': 'contact_person', 'contact_person': 'contact_person', 'contactPerson': 'contact_person',
        '注文番号': 'order_number', 'order_number': 'order_number', 'orderNumber': 'order_number',
        '工事番号': 'construction_number', 'construction_number': 'construction_number', 'constructionNumber': 'construction_number',
        'ステータス': 'status', 'status': 'status',
        '備考': 'notes', 'notes': 'notes',
        '品名': 'name', 'name': 'name',
        '数量': 'quantity', 'quantity': 'quantity',
        '加工費': 'processing_cost', 'processing_cost': 'processing_cost', 'processingCost': 'processing_cost',
        '材料費': 'material_cost', 'material_cost': 'material_cost', 'materialCost': 'material_cost',
        'その他': 'other_cost', 'other_cost': 'other_cost', 'otherCost': 'other_cost',
        '見積ID': 'display_id', 'display_id': 'display_id', 'displayId': 'display_id',
    };

    const mapped = {};
    for (const [key, value] of Object.entries(record)) {
        const dbField = fieldMap[key];
        if (dbField) {
            mapped[dbField] = value;
        }
    }

    // CSVの場合、各行が1案件1明細
    // JSONの場合、items配列があればそのまま使う
    if (record.items && Array.isArray(record.items)) {
        mapped.items = record.items.map(item => {
            const mappedItem = {};
            for (const [key, value] of Object.entries(item)) {
                const dbField = fieldMap[key];
                if (dbField) mappedItem[dbField] = value;
            }
            return mappedItem;
        });
    } else if (mapped.name) {
        // CSVフラット形式: 品名があれば1明細として扱う
        mapped.items = [{
            name: mapped.name,
            quantity: mapped.quantity,
            processing_cost: mapped.processing_cost,
            material_cost: mapped.material_cost,
            other_cost: mapped.other_cost,
        }];
        delete mapped.name;
        delete mapped.quantity;
        delete mapped.processing_cost;
        delete mapped.material_cost;
        delete mapped.other_cost;
    } else {
        mapped.items = [];
    }

    return mapped;
}

module.exports = router;
