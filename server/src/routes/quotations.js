const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { checkTrialLimit } = require('../middleware/trialMiddleware');
const { supabaseAdmin } = require('../config/supabase');
const { AppError } = require('../middleware/errorHandler');
const { generateQuotationId, parsePrice } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');

const PAGE_SIZE = 20;

/**
 * GET /api/quotations
 * 見積一覧（ページネーション・フィルタ対応、論理削除は除外）
 */
router.get('/', authMiddleware, checkTrialLimit, async (req, res, next) => {
    try {
        console.log(`[Quotations] GET / - tenantId: ${req.tenantId}`);

        // Super Admin (platform) の場合は一般の案件一覧データを返さない
        if (req.tenantId === 'platform') {
            return res.json({
                data: [],
                total: 0,
                page: 1,
                pageSize: PAGE_SIZE,
                totalPages: 0,
            });
        }

        const { page = 1, limit, status, search, sortBy = 'created_at', sortDir = 'desc', showDeleted = 'false' } = req.query;

        let from = 0;
        let to = PAGE_SIZE - 1;
        if (limit) {
            to = parseInt(limit) - 1;
        } else {
            from = (parseInt(page) - 1) * PAGE_SIZE;
            to = from + PAGE_SIZE - 1;
        }

        let query = supabaseAdmin
            .from('quotations')
            .select('*, quotation_items(*), quotation_files(id, original_name, file_type)', { count: 'exact' })
            .eq('tenant_id', req.tenantId)
            .eq('is_deleted', showDeleted === 'true');

        if (status && status !== 'delivered' && status !== 'unentered_actuals') {
            query = query.eq('status', status);
        } else if (status === 'delivered' || status === 'unentered_actuals') {
            query = query.eq('status', 'ordered'); // 両者とも受注ステータスが前提
        }

        if (search) {
            const terms = search.trim().split(/[\s　]+/);

            // 1. 各キーワードを含む明細（品名）の親案件IDを取得
            let matchedIdsByTerm = {};
            const validTerms = terms.filter(t => t);

            if (validTerms.length > 0) {
                const itemOrs = validTerms.map(t => `name.ilike.%${t}%`).join(',');
                const { data: matchedItems } = await supabaseAdmin
                    .from('quotation_items')
                    .select('quotation_id, name')
                    .eq('tenant_id', req.tenantId)
                    .or(itemOrs);

                if (matchedItems) {
                    matchedItems.forEach(item => {
                        validTerms.forEach(term => {
                            if (item.name && item.name.toLowerCase().includes(term.toLowerCase())) {
                                if (!matchedIdsByTerm[term]) matchedIdsByTerm[term] = [];
                                matchedIdsByTerm[term].push(item.quotation_id);
                            }
                        });
                    });
                }
            }

            // 2. OR条件にメインテーブルのフィールド + マッチした親案件IDを含める
            validTerms.forEach(term => {
                let orClause = `company_name.ilike.%${term}%,order_number.ilike.%${term}%,construction_number.ilike.%${term}%,contact_person.ilike.%${term}%,notes.ilike.%${term}%,display_id.ilike.%${term}%`;
                const ids = matchedIdsByTerm[term] || [];
                if (ids.length > 0) {
                    const uniqueIds = [...new Set(ids)];
                    orClause += `,id.in.(${uniqueIds.join(',')})`;
                }
                query = query.or(orClause);
            });

        }

        // 'delivered' または 'unentered_actuals' フィルタの場合は全件取得後にJS側でフィルタして手動ページネーションする
        if (status === 'delivered' || status === 'unentered_actuals') {
            const { data, error } = await query.order(sortBy, { ascending: sortDir === 'asc' });
            if (error) throw new AppError('Failed to fetch quotations', 500, 'FETCH_FAILED');

            const filteredData = data.filter(q => {
                const items = q.quotation_items || [];
                if (items.length === 0) return false;

                // 共通条件: 全ての明細に納品日が設定されていること
                const isDelivered = items.every(item => item.delivery_date !== null);
                if (!isDelivered) return false;

                if (status === 'unentered_actuals') {
                    // 追加条件: 全ての明細の実績値（加工費、材料費、他費用、実績時間）がすべて未入力であること
                    return items.every(item =>
                        (item.actual_processing_cost === null || item.actual_processing_cost === 0) &&
                        (item.actual_material_cost === null || item.actual_material_cost === 0) &&
                        (item.actual_other_cost === null || item.actual_other_cost === 0) &&
                        (item.actual_hours === null || item.actual_hours === 0)
                    );
                }
                return true; // delivered の場合はここで返る
            });

            const total = filteredData.length;
            const paginatedData = filteredData.slice(from, to + 1);

            return res.json({
                data: paginatedData,
                total,
                page: parseInt(page),
                pageSize: PAGE_SIZE,
                totalPages: Math.ceil(total / PAGE_SIZE),
            });
        }

        // 通常のクエリの場合はDB上でページネーションする
        const { data, count, error } = await query
            .order(sortBy, { ascending: sortDir === 'asc' })
            .range(from, to);

        if (error) throw new AppError('Failed to fetch quotations', 500, 'FETCH_FAILED');

        res.json({
            data,
            total: count,
            page: parseInt(page),
            pageSize: PAGE_SIZE,
            totalPages: Math.ceil(count / PAGE_SIZE),
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/quotations/check-duplicate
 * 重複チェック（注文番号・工事番号）
 */
router.get('/check-duplicate', authMiddleware, checkTrialLimit, async (req, res, next) => {
    try {
        const { orderNumber, constructionNumber, excludeId } = req.query;
        if (!orderNumber && !constructionNumber) {
            return res.json({ duplicate: false });
        }

        let query = supabaseAdmin
            .from('quotations')
            .select('id, display_id, order_number, construction_number, company_name')
            .eq('tenant_id', req.tenantId)

            .eq('is_deleted', false);

        if (excludeId) {
            query = query.neq('id', excludeId);
        }

        const orConditions = [];
        if (orderNumber) orConditions.push(`order_number.eq.${orderNumber}`);
        if (constructionNumber) orConditions.push(`construction_number.eq.${constructionNumber}`);

        if (orConditions.length > 0) {
            query = query.or(orConditions.join(','));
        }

        const { data, error } = await query;
        if (error) throw new AppError('Failed to check duplicates', 500, 'CHECK_FAILED');

        const result = {
            duplicate: data.length > 0,
            matches: data.map(d => ({
                id: d.id,
                displayId: d.display_id,
                orderNumber: d.order_number,
                constructionNumber: d.construction_number,
                companyName: d.company_name
            }))

        };

        res.json(result);
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/quotations/:id
 * 論理削除 (ゴミ箱へ移動)
 */
router.delete('/:id', authMiddleware, checkTrialLimit, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('quotations')
            .update({ is_deleted: true, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('tenant_id', req.tenantId);

        if (error) throw new AppError('Failed to delete quotation', 500, 'DELETE_FAILED');

        // 変更履歴に記録
        await supabaseAdmin.from('quotation_history').insert({
            quotation_id: id,
            tenant_id: req.tenantId,
            changed_by: req.user.id,
            change_type: 'deleted',
            changes: { message: '案件をゴミ箱に移動しました' },
        });

        res.json({ message: 'Quotation moved to trash' });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/quotations/:id/restore
 * 復元処理
 */
router.post('/:id/restore', authMiddleware, checkTrialLimit, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('quotations')
            .update({ is_deleted: false, deleted_at: null, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('tenant_id', req.tenantId);

        if (error) throw new AppError('Failed to restore quotation', 500, 'RESTORE_FAILED');

        // 変更履歴に記録
        await supabaseAdmin.from('quotation_history').insert({
            quotation_id: id,
            tenant_id: req.tenantId,
            changed_by: req.user.id,
            change_type: 'restored',
            changes: { message: '案件をゴミ箱から復元しました' },
        });

        res.json({ message: 'Quotation restored' });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/quotations/:id/permanent
 * 完全削除
 */
router.delete('/:id/permanent', authMiddleware, checkTrialLimit, async (req, res, next) => {
    try {
        // 管理者チェックを入れるのが望ましい
        if (error) throw new AppError('Failed to permanently delete quotation', 500, 'DELETE_FAILED');

        // 完全削除の履歴（親が消えると消える可能性があるが、ログとして残す試み）
        await supabaseAdmin.from('quotation_history').insert({
            quotation_id: req.params.id,
            tenant_id: req.tenantId,
            changed_by: req.user.id,
            change_type: 'permanently_deleted',
            changes: { message: '案件が完全に削除されました' },
        });

        res.json({ message: 'Quotation permanently deleted' });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/quotations/items/search
 * 過去の案件明細を品名で検索
 */
router.get('/items/search', authMiddleware, checkTrialLimit, async (req, res, next) => {
    try {
        const { q, limit = 20 } = req.query;
        if (!q) return res.json([]);

        const { data, error } = await supabaseAdmin
            .from('quotation_items')
            .select(`
                *,
                quotations!inner(
                    id,
                    display_id,
                    company_name,
                    order_number,
                    created_at,
                    status,
                    is_deleted,
                    quotation_files (
                        id,
                        original_name,
                        file_type
                    )
                )
            `)
            .eq('tenant_id', req.tenantId)
            .eq('quotations.is_deleted', false)
            .ilike('name', `%${q}%`)
            .order('id', { ascending: false })
            .limit(parseInt(limit));

        if (error) {
            console.error('Search error:', error);
            throw new AppError('Failed to search items', 500, 'SEARCH_FAILED');
        }

        res.json(data);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/quotations/:id
 * 見積詳細
 */
router.get('/:id', authMiddleware, checkTrialLimit, async (req, res, next) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('quotations')
            .select('*, quotation_items(*), quotation_files(*), quotation_source_files(*), quotation_history(*, users(name))')
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId)
            .single();

        if (error || !data) throw new AppError('Quotation not found', 404, 'NOT_FOUND');
        res.json(data);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/quotations
 * 見積新規作成
 */
router.post('/', authMiddleware, checkTrialLimit, async (req, res, next) => {
    try {
        const {
            companyName, contactPerson, emailLink, notes,
            orderNumber, constructionNumber, status = 'pending',
            items = [], sourceId, copyFileIds = [],
        } = req.body;

        const displayId = await generateQuotationId(supabaseAdmin, req.tenantId);

        // 会社マスタ自動登録
        if (companyName) {
            await supabaseAdmin
                .from('companies')
                .upsert({ tenant_id: req.tenantId, name: companyName }, { onConflict: 'tenant_id,name' });
        }

        console.log('[Quotations] Creating quotation header...');
        // 見積ヘッダー作成
        const { data: quotation, error: qError } = await supabaseAdmin
            .from('quotations')
            .insert({
                display_id: displayId,
                tenant_id: req.tenantId,
                company_name: companyName || '',
                contact_person: contactPerson || '',
                email_link: emailLink || '',
                notes: notes || '',
                order_number: orderNumber || '',
                construction_number: constructionNumber || '',
                status,
                source_id: sourceId || null,
                created_by: req.user.id,
            })
            .select()
            .single();

        if (qError) {
            console.error('[Quotations] Header creation failed:', qError);
            throw new AppError('Failed to create quotation', 500, 'CREATE_FAILED');
        }

        const newId = quotation.id;
        console.log(`[Quotations] Header created. ID: ${newId}`);

        // 明細行作成
        if (items.length > 0) {
            console.log(`[Quotations] Creating ${items.length} items...`);
            const itemRows = items.map((item, idx) => ({
                quotation_id: newId,
                tenant_id: req.tenantId,
                sort_order: idx,
                name: item.name || '',
                quantity: parsePrice(item.quantity) || 1,
                processing_cost: parsePrice(item.processingCost),
                material_cost: parsePrice(item.materialCost),
                other_cost: parsePrice(item.otherCost),
                response_date: item.responseDate || null,
                due_date: item.dueDate || null,
                delivery_date: item.deliveryDate || null,
                scheduled_start_date: item.scheduledStartDate || null,
                actual_hours: parsePrice(item.actualHours),
                actual_processing_cost: parsePrice(item.actualProcessingCost),
                actual_material_cost: parsePrice(item.actualMaterialCost),
                actual_other_cost: parsePrice(item.actualOtherCost),
                actual_mode: item.actualMode || 'amount',
            }));

            const { error: itemError } = await supabaseAdmin
                .from('quotation_items')
                .insert(itemRows);

            if (itemError) {
                console.error('[Quotations] Item creation failed:', itemError);
                // ヘッダーはできているので、ここではエラーを投げずに続行（ログのみ）
            }
        }

        // 変更履歴に新規作成を追加
        await supabaseAdmin.from('quotation_history').insert({
            quotation_id: quotation.id,
            tenant_id: req.tenantId,
            changed_by: req.user.id,
            change_type: 'created',
            changes: { message: '案件が新規登録されました' }
        });

        // 転用元ファイルの物理コピー
        if (copyFileIds && copyFileIds.length > 0) {
            console.log(`[Quotations] Copying ${copyFileIds.length} files...`);
            for (const fileId of copyFileIds) {
                const { data: sf } = await supabaseAdmin
                    .from('quotation_files')
                    .select('*')
                    .eq('id', fileId)
                    .eq('tenant_id', req.tenantId)
                    .single();

                if (sf) {
                    const newFileId = uuidv4();
                    const ext = sf.original_name.split('.').pop();
                    const newStoragePath = `${req.tenantId}/${newId}/${newFileId}.${ext}`;

                    const { error: copyErr } = await supabaseAdmin.storage
                        .from('quotation-files')
                        .copy(sf.storage_path, newStoragePath);

                    if (!copyErr) {
                        await supabaseAdmin.from('quotation_files').insert({
                            id: newFileId,
                            quotation_id: newId,
                            tenant_id: req.tenantId,
                            storage_path: newStoragePath,
                            original_name: sf.original_name,
                            file_hash: sf.file_hash,
                            file_size: sf.file_size,
                            mime_type: sf.mime_type,
                            file_type: sf.file_type
                        });
                    } else {
                        console.error('[Quotations] File copy failed:', copyErr);
                    }
                }
            }
        }

        console.log('[Quotations] Created successfully');
        res.status(201).json(quotation);
    } catch (err) {
        console.error('[Quotations] FATAL ERROR in POST /:', err);
        next(err);
    }
});

/**
 * PUT /api/quotations/:id
 * 見積更新
 */
router.put('/:id', authMiddleware, checkTrialLimit, async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            companyName, contactPerson, emailLink, notes,
            orderNumber, constructionNumber, status,
            items, copyFileIds = [],
        } = req.body;

        // 既存データ取得
        const { data: existing } = await supabaseAdmin
            .from('quotations')
            .select('*, quotation_items(*)')
            .eq('id', id)
            .eq('tenant_id', req.tenantId)
            .single();

        if (!existing) throw new AppError('Quotation not found', 404, 'NOT_FOUND');

        // ヘッダー更新
        const updates = {
            updated_at: new Date().toISOString(),
        };
        if (companyName !== undefined) updates.company_name = companyName;
        if (contactPerson !== undefined) updates.contact_person = contactPerson;
        if (emailLink !== undefined) updates.email_link = emailLink;
        if (notes !== undefined) updates.notes = notes;
        if (orderNumber !== undefined) updates.order_number = orderNumber;
        if (constructionNumber !== undefined) updates.construction_number = constructionNumber;
        if (status !== undefined) updates.status = status;

        const { data: updated, error: updateError } = await supabaseAdmin
            .from('quotations')
            .update(updates)
            .eq('id', id)
            .eq('tenant_id', req.tenantId)
            .select()
            .single();

        if (updateError) throw new AppError('Failed to update quotation', 500, 'UPDATE_FAILED');

        // 明細行の更新（全削除→再挿入方式）
        if (items !== undefined) {
            await supabaseAdmin
                .from('quotation_items')
                .delete()
                .eq('quotation_id', id);

            if (items.length > 0) {
                const itemRows = items.map((item, idx) => ({
                    quotation_id: id,
                    tenant_id: req.tenantId,
                    sort_order: idx,
                    name: item.name || '',
                    quantity: parsePrice(item.quantity) || 1,
                    processing_cost: parsePrice(item.processingCost),
                    material_cost: parsePrice(item.materialCost),
                    other_cost: parsePrice(item.otherCost),
                    response_date: item.responseDate || null,
                    due_date: item.dueDate || null,
                    delivery_date: item.deliveryDate || null,
                    scheduled_start_date: item.scheduledStartDate || null,
                    actual_hours: parsePrice(item.actualHours),
                    actual_processing_cost: parsePrice(item.actualProcessingCost),
                    actual_material_cost: parsePrice(item.actualMaterialCost),
                    actual_other_cost: parsePrice(item.actualOtherCost),
                    actual_mode: item.actualMode || 'amount',
                }));

                await supabaseAdmin.from('quotation_items').insert(itemRows);
            }
        }

        // 転用元ファイルの物理コピー (PUT時)
        if (copyFileIds && copyFileIds.length > 0) {
            for (const fileId of copyFileIds) {
                const { data: sf } = await supabaseAdmin
                    .from('quotation_files')
                    .select('*')
                    .eq('id', fileId)
                    .eq('tenant_id', req.tenantId)
                    .single();

                if (sf) {
                    const newFileId = require('uuid').v4();
                    const ext = sf.original_name.split('.').pop();
                    const newStoragePath = `${req.tenantId}/${id}/${newFileId}.${ext}`;

                    const { error: copyErr } = await supabaseAdmin.storage
                        .from('quotation-files')
                        .copy(sf.storage_path, newStoragePath);

                    if (!copyErr) {
                        await supabaseAdmin.from('quotation_files').insert({
                            id: newFileId,
                            quotation_id: id,
                            tenant_id: req.tenantId,
                            storage_path: newStoragePath,
                            original_name: sf.original_name,
                            file_hash: sf.file_hash,
                            file_size: sf.file_size,
                            mime_type: sf.mime_type,
                            file_type: sf.file_type
                        });
                    }
                }
            }
        }

        // 変更履歴
        const changes = {};
        const fieldLabels = {
            company_name: '社名',
            contact_person: '担当者',
            email_link: 'メールリンク',
            notes: '備考',
            order_number: '注文番号',
            construction_number: '工事番号',
            status: 'ステータス'
        };

        Object.keys(updates).forEach(key => {
            if (key !== 'updated_at' && existing[key] !== updates[key]) {
                const label = fieldLabels[key] || key;
                changes[label] = { from: existing[key], to: updates[key] };
            }
        });

        // 明細の変更検知
        if (items !== undefined) {
            const oldItems = existing.quotation_items || [];
            const mapForCompare = (list, isNew) => list.map(i => ({
                name: i.name,
                processing_cost: Number((isNew ? i.processingCost : i.processing_cost) || 0),
                material_cost: Number((isNew ? i.materialCost : i.material_cost) || 0),
                other_cost: Number((isNew ? i.otherCost : i.other_cost) || 0),
                quantity: Number(i.quantity || 0),
                unit: i.unit,
                response_date: (isNew ? i.responseDate : i.response_date) || null,
                due_date: (isNew ? i.dueDate : i.due_date) || null,
                delivery_date: (isNew ? i.deliveryDate : i.delivery_date) || null,
                scheduled_start_date: (isNew ? i.scheduledStartDate : i.scheduled_start_date) || null
            }));

            const oldJson = JSON.stringify(mapForCompare(oldItems, false));
            const newJson = JSON.stringify(mapForCompare(items, true));

            if (oldJson !== newJson) {
                if (oldItems.length !== items.length) {
                    changes['明細数'] = { from: `${oldItems.length}件`, to: `${items.length}件` };
                } else {
                    changes['明細内容'] = { from: '変更前', to: '更新あり' };
                    // 1枚のみの場合、詳細なフィールド比較を行う
                    if (oldItems.length === 1 && items.length === 1) {
                        const o = oldItems[0];
                        const n = items[0];
                        const compareDate = (oVal, nVal) => {
                            const d1 = oVal ? new Date(oVal).toLocaleDateString('ja-JP') : '未設定';
                            const d2 = nVal ? new Date(nVal).toLocaleDateString('ja-JP') : '未設定';
                            return d1 === d2 ? null : { from: d1, to: d2 };
                        };

                        if (o.name !== n.name) changes['明細名称'] = { from: o.name || '空', to: n.name || '空' };

                        const oPrice = Number(o.processing_cost || 0) + Number(o.material_cost || 0) + Number(o.other_cost || 0);
                        const nPrice = Number(n.processingCost || 0) + Number(n.materialCost || 0) + Number(n.otherCost || 0);
                        if (oPrice !== nPrice) changes['明細単価'] = { from: `¥${oPrice.toLocaleString()}`, to: `¥${nPrice.toLocaleString()}` };

                        if (Number(o.quantity) !== Number(n.quantity)) changes['明細数量'] = { from: o.quantity, to: n.quantity };

                        const d1 = compareDate(o.response_date, n.responseDate);
                        if (d1) changes['回答日'] = d1;
                        const d2 = compareDate(o.due_date, n.dueDate);
                        if (d2) changes['納期'] = d2;
                        const d3 = compareDate(o.delivery_date, n.deliveryDate);
                        if (d3) changes['納品日'] = d3;
                        const d4 = compareDate(o.scheduled_start_date, n.scheduledStartDate);
                        if (d4) changes['着手予定日'] = d4;
                    }
                }
            }
        }

        if (Object.keys(changes).length > 0) {
            await supabaseAdmin.from('quotation_history').insert({
                quotation_id: id,
                tenant_id: req.tenantId,
                changed_by: req.user.id,
                change_type: 'updated',
                changes,
            });
        }

        res.json(updated);
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/quotations/:id
 */
router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const { error } = await supabaseAdmin
            .from('quotations')
            .delete()
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId);

        if (error) throw new AppError('Failed to delete quotation', 500, 'DELETE_FAILED');
        res.json({ message: 'Quotation deleted' });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/quotations/batch-delivery
 * 一括納品処理
 */
router.post('/batch-delivery', authMiddleware, async (req, res, next) => {
    try {
        const { itemIds, deliveryDate } = req.body;
        if (!Array.isArray(itemIds) || itemIds.length === 0) {
            throw new AppError('Item IDs are required', 400, 'VALIDATION_ERROR');
        }

        const { error } = await supabaseAdmin
            .from('quotation_items')
            .update({ delivery_date: deliveryDate || new Date().toISOString().split('T')[0] })
            .eq('tenant_id', req.tenantId)
            .in('id', itemIds);

        if (error) throw new AppError('Failed to update delivery dates', 500, 'BATCH_FAILED');
        res.json({ message: `${itemIds.length} items delivered`, count: itemIds.length });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
