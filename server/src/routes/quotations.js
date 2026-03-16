const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { checkTrialLimit } = require('../middleware/trialMiddleware');
const { supabaseAdmin } = require('../config/supabase');
const { AppError } = require('../middleware/errorHandler');
const { generateQuotationId, parsePrice, normalizeSearchTerm } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');
const logService = require('../services/logService');
const aiLearningService = require('../services/aiLearningService');

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

        const { 
            page = 1, 
            limit, 
            status, 
            search, 
            isVerified, 
            material,
            processingMethod,
            surfaceTreatment,
            sortBy = 'created_at', 
            sortDir = 'desc', 
            showDeleted = 'false' 
        } = req.query;

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
            .select('*, quotation_items(*), quotation_files(id, original_name, file_type, storage_path)', { count: 'exact' })
            .eq('tenant_id', req.tenantId)
            .eq('is_deleted', showDeleted === 'true');

        if (status && status !== 'delivered' && status !== 'unentered_actuals') {
            query = query.eq('status', status);
        } else if (status === 'delivered' || status === 'unentered_actuals') {
            query = query.eq('status', 'ordered'); // 両者とも受注ステータスが前提
        }

        if (isVerified !== undefined && isVerified !== '') {
            query = query.eq('is_verified', isVerified === 'true');
        }

        if (search) {
            const rawTerms = search.trim().split(/[\s　]+/);
            const validTerms = rawTerms.filter(t => t).map(t => normalizeSearchTerm(t));

            // 1. 各キーワードを含む明細（品名）の親案件IDを取得
            let matchedIdsByTerm = {};

            if (validTerms.length > 0) {
                // Supabase の .or() 内でカンマや括弧がある場合、二重引用符で囲む必要がある
                const itemOrs = validTerms.map(t => 
                    `name.ilike."%${t}%",material.ilike."%${t}%",processing_method.ilike."%${t}%",surface_treatment.ilike."%${t}%"`
                ).join(',');
                const { data: matchedItems } = await supabaseAdmin
                    .from('quotation_items')
                    .select('quotation_id, name')
                    .eq('tenant_id', req.tenantId)
                    .or(itemOrs);

                if (matchedItems) {
                    matchedItems.forEach(item => {
                        validTerms.forEach(term => {
                            if (item.name && normalizeSearchTerm(item.name).includes(term)) {
                                if (!matchedIdsByTerm[term]) matchedIdsByTerm[term] = [];
                                matchedIdsByTerm[term].push(item.quotation_id);
                            }
                        });
                    });
                }
            }

            // 2. OR条件にメインテーブルのフィールド + マッチした親案件IDを含める
            validTerms.forEach(term => {
                let orClause = `company_name.ilike."%${term}%",order_number.ilike."%${term}%",construction_number.ilike."%${term}%",contact_person.ilike."%${term}%",notes.ilike."%${term}%",display_id.ilike."%${term}%"`;
                const ids = matchedIdsByTerm[term] || [];
                if (ids.length > 0) {
                    const uniqueIds = [...new Set(ids)];
                    orClause += `,id.in.(${uniqueIds.join(',')})`;
                }
                query = query.or(orClause);
            });
        }

        // 3. 個別フィルター (材質・加工・処理)
        if (material || processingMethod || surfaceTreatment) {
            let itemFilters = [];
            if (material) itemFilters.push(`material.ilike."%${material}%"`);
            if (processingMethod) itemFilters.push(`processing_method.ilike."%${processingMethod}%"`);
            if (surfaceTreatment) itemFilters.push(`surface_treatment.ilike."%${surfaceTreatment}%"`);

            const { data: filterMatchedItems } = await supabaseAdmin
                .from('quotation_items')
                .select('quotation_id')
                .eq('tenant_id', req.tenantId)
                .or(itemFilters.join(','));

            if (filterMatchedItems && filterMatchedItems.length > 0) {
                const uniqueIds = [...new Set(filterMatchedItems.map(i => i.quotation_id))];
                query = query.in('id', uniqueIds);
            } else {
                // フィルターに合致する明細がない場合は空の結果を返すよう、存在しないIDで絞り込む
                query = query.eq('id', '00000000-0000-0000-0000-000000000000');
            }
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
 * GET /api/quotations/stats
 * ダッシュボード統計パネル用の集計済みデータ取得
 */
router.get('/stats', authMiddleware, checkTrialLimit, async (req, res, next) => {
    try {
        // テナント情報と案件データを並列で取得
        const [tenantRes, quotesRes] = await Promise.all([
            supabaseAdmin.from('tenants').select('hourly_rate').eq('id', req.tenantId).single(),
            supabaseAdmin.from('quotations').select(`
                status,
                created_at,
                quotation_items (
                    processing_cost,
                    material_cost,
                    other_cost,
                    quantity,
                    delivery_date,
                    due_date,
                    actual_hours
                )
            `)
            .eq('tenant_id', req.tenantId)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(1000)
        ]);

        if (quotesRes.error) throw new AppError('Failed to fetch stats data', 500, 'FETCH_FAILED');
        const hourlyRate = tenantRes.data?.hourly_rate || 8000;
        const data = quotesRes.data || [];

        // 集計ロジックをサーバーサイドに移行
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth();

        const initializeMetrics = () => ({
            total: 0, ordered: 0, delivered: 0, lost: 0, pending: 0,
            salesAmount: 0, pendingAmount: 0,
            orderedProcEstTotal: 0, orderedProcActTotal: 0,
            orderedHasActuals: false
        });

        const allTime = initializeMetrics();
        const currentMonth = initializeMetrics();

        // 直近6ヶ月の推移用データの初期化
        const historyMap = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            historyMap[key] = { date: key, sales: 0, count: 0 };
        }

        data.forEach(q => {
            const qDate = new Date(q.created_at);
            const isQInCurMonth = qDate.getFullYear() === curYear && qDate.getMonth() === curMonth;

            // 状態カウント
            allTime.total++;
            if (isQInCurMonth) currentMonth.total++;

            if (q.status === 'ordered') { allTime.ordered++; if (isQInCurMonth) currentMonth.ordered++; }
            else if (q.status === 'delivered') { allTime.delivered++; if (isQInCurMonth) currentMonth.delivered++; }
            else if (q.status === 'lost') { allTime.lost++; if (isQInCurMonth) currentMonth.lost++; }
            else if (q.status === 'pending') { allTime.pending++; if (isQInCurMonth) currentMonth.pending++; }

            const items = q.quotation_items || [];
            let qTotalCost = 0;
            items.forEach(i => {
                const qty = Number(i.quantity) || 1;
                const cost = (Number(i.processing_cost) || 0) + (Number(i.material_cost) || 0) + (Number(i.other_cost) || 0);
                const totalCost = Math.round(cost * qty);
                qTotalCost += totalCost;

                const dDateStr = i.delivery_date || i.due_date;
                const dDate = dDateStr ? new Date(dDateStr) : null;
                const isDInCurMonth = dDate && dDate.getFullYear() === curYear && dDate.getMonth() === curMonth;

                // 売上集計 (ordered or delivered)
                if (q.status === 'ordered' || q.status === 'delivered') {
                    allTime.salesAmount += totalCost;
                    if (isDInCurMonth) currentMonth.salesAmount += totalCost;

                    // 加工費収支 (ordered のみ、今月フィルタは納期/納品日で判定)
                    if (q.status === 'ordered') {
                        const estProc = Math.round((Number(i.processing_cost) || 0) * qty);
                        const actHours = Number(i.actual_hours) || 0;
                        const actProc = actHours > 0 ? Math.round(actHours * hourlyRate) : 0;

                        allTime.orderedProcEstTotal += estProc;
                        allTime.orderedProcActTotal += actProc;
                        if (actHours > 0) allTime.orderedHasActuals = true;

                        if (isDInCurMonth) {
                            currentMonth.orderedProcEstTotal += estProc;
                            currentMonth.orderedProcActTotal += actProc;
                            if (actHours > 0) currentMonth.orderedHasActuals = true;
                        }
                    }
                } 
                // 検討中残高
                else if (q.status !== 'lost') {
                    allTime.pendingAmount += totalCost;
                    if (isQInCurMonth) currentMonth.pendingAmount += totalCost;
                }
            });

            // ヒストリ計算 (月別売上と件数)
            if (q.status === 'ordered' || q.status === 'delivered') {
                const key = `${qDate.getFullYear()}-${String(qDate.getMonth() + 1).padStart(2, '0')}`;
                if (historyMap[key]) {
                    historyMap[key].sales += qTotalCost;
                    historyMap[key].count += 1;
                }
            }
        });

        // 勝率等の算出
        const finalize = (m) => {
            const totalCount = m.ordered + m.delivered + m.lost + m.pending;
            m.winRate = totalCount > 0 ? ((m.ordered + m.delivered) / totalCount) * 100 : 0;
            m.orderedVariance = m.orderedProcActTotal - m.orderedProcEstTotal;
            m.orderedVariancePct = m.orderedProcEstTotal > 0 ? (m.orderedVariance / m.orderedProcEstTotal) * 100 : 0;
        };

        finalize(allTime);
        finalize(currentMonth);

        const history = Object.values(historyMap).sort((a, b) => a.date.localeCompare(b.date));

        res.json({ allTime, currentMonth, history });
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

        if (orderNumber) {
            query = query.eq('order_number', orderNumber);
        } else {
            return res.json({ duplicate: false, matches: [] });
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

        await logService.audit({
            action: 'quotation_deleted',
            entityType: 'quotation',
            entityId: id,
            description: `案件をゴミ箱に移動しました`,
            tenantId: req.tenantId,
            userId: req.userId
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

        await logService.audit({
            action: 'quotation_restored',
            entityType: 'quotation',
            entityId: id,
            description: `案件をゴミ箱から復元しました`,
            tenantId: req.tenantId,
            userId: req.userId
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

        await logService.audit({
            action: 'quotation_permanently_deleted',
            entityType: 'quotation',
            entityId: req.params.id,
            description: `案件を完全に削除しました`,
            tenantId: req.tenantId,
            userId: req.userId
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
 * GET /api/quotations/unique-filters
 * フィルターに使用するユニークな値（材質、加工方法、表面処理）を取得
 */
router.get('/unique-filters', authMiddleware, async (req, res, next) => {
    try {
        const { data: items, error } = await supabaseAdmin
            .from('quotation_items')
            .select('material, processing_method, surface_treatment')
            .eq('tenant_id', req.tenantId);

        if (error) throw error;

        const uniqueMaterials = [...new Set(items.map(i => i.material).filter(v => v))].sort();
        const uniqueMethods = [...new Set(items.map(i => i.processing_method).filter(v => v))].sort();
        const uniqueTreatments = [...new Set(items.map(i => i.surface_treatment).filter(v => v))].sort();

        res.json({
            materials: uniqueMaterials,
            methods: uniqueMethods,
            treatments: uniqueTreatments
        });
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
            companyName, contactPerson, emailLink, notes, systemNotes,
            orderNumber, constructionNumber, status = 'pending',
            isVerified = true, items = [], sourceId, copyFileIds = [],
            aiOriginalResult = null,
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
                system_notes: systemNotes || '',
                order_number: orderNumber || '',
                construction_number: constructionNumber || '',
                status,
                is_verified: isVerified,
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
                scheduled_end_date: item.scheduledEndDate || null,
                actual_hours: parsePrice(item.actualHours),
                actual_processing_cost: parsePrice(item.actualProcessingCost),
                actual_material_cost: parsePrice(item.actualMaterialCost),
                actual_other_cost: parsePrice(item.actualOtherCost),
                actual_mode: item.actualMode || 'amount',
                material_metadata: item.material_metadata || null,
                heat_treatment: item.material_metadata?.heatTreatment || null,
                dimensions: item.dimensions || '',
                requires_verification: item.requiresVerification ?? item.requires_verification ?? false,
                material: item.material || null,
                processing_method: item.processingMethod ?? item.processing_method ?? null,
                surface_treatment: item.surfaceTreatment ?? item.surface_treatment ?? null,
            }));

            const { error: itemError } = await supabaseAdmin
                .from('quotation_items')
                .insert(itemRows);

            if (itemError) {
                console.error('[Quotations] Item creation failed:', itemError);
                throw new AppError('Failed to create quotation items: ' + itemError.message, 500, 'CREATE_FAILED');
            }
        }

        console.log('[Quotations] Created successfully');
        res.status(201).json(quotation);

        // 学習処理 (バックグラウンド)
        if (aiOriginalResult) {
            aiLearningService.learnFromCorrection(req.tenantId, aiOriginalResult, {
                companyName,
                orderNumber,
                constructionNumber,
                notes,
                items
            }).catch(err => console.error('[Quotations] Learning error:', err));
        }

        // --- 以降はレスポンス返却後のバックグラウンド処理 ---
        (async () => {
            try {
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
                    console.log(`[Quotations] Background: Copying ${copyFileIds.length} files...`);
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
                                console.error('[Quotations] Background: File copy failed:', copyErr);
                            }
                        }
                    }
                }

                await logService.audit({
                    action: 'quotation_created',
                    entityType: 'quotation',
                    entityId: quotation.id,
                    description: `案件新規作成: ${displayId}`,
                    tenantId: req.tenantId,
                    userId: req.userId
                });
                console.log(`[Quotations] Background cleanup complete for ${newId}`);
            } catch (bgErr) {
                console.error('[Quotations] Background task error:', bgErr);
            }
        })();
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
            companyName, contactPerson, emailLink, notes, systemNotes,
            orderNumber, constructionNumber, status,
            items, copyFileIds = [],
            aiOriginalResult = null,
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
        if (systemNotes !== undefined) updates.system_notes = systemNotes;
        if (orderNumber !== undefined) updates.order_number = orderNumber;
        if (constructionNumber !== undefined) updates.construction_number = constructionNumber;
        if (status !== undefined) updates.status = status;
        
        // ユーザーが明示的に更新した場合は確認済み（true）にする
        updates.is_verified = true;

        const { data: updated, error: updateError } = await supabaseAdmin
            .from('quotations')
            .update(updates)
            .eq('id', id)
            .eq('tenant_id', req.tenantId)
            .select()
            .single();

        if (updateError) throw new AppError('Failed to update quotation', 500, 'UPDATE_FAILED');

        // 学習処理 (バックグラウンド)
        if (aiOriginalResult) {
            aiLearningService.learnFromCorrection(req.tenantId, aiOriginalResult, {
                companyName,
                orderNumber,
                constructionNumber,
                notes,
                items
            }).catch(err => console.error('[Quotations] Learning error:', err));
        }

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
                    scheduled_end_date: item.scheduledEndDate || null,
                    actual_hours: parsePrice(item.actualHours),
                    actual_processing_cost: parsePrice(item.actualProcessingCost),
                    actual_material_cost: parsePrice(item.actualMaterialCost),
                    actual_other_cost: parsePrice(item.actualOtherCost),
                    actual_mode: item.actualMode || 'amount',
                    material_metadata: item.material_metadata || null,
                    heat_treatment: item.material_metadata?.heatTreatment || null,
                    dimensions: item.dimensions || '',
                    requires_verification: item.requiresVerification ?? item.requires_verification ?? false,
                    material: item.material || null,
                    processing_method: item.processingMethod ?? item.processing_method ?? null,
                    surface_treatment: item.surfaceTreatment ?? item.surface_treatment ?? null,
                }));

                const { error: insertError } = await supabaseAdmin.from('quotation_items').insert(itemRows);
                if (insertError) {
                    console.error('[Quotations] Item update failed:', insertError);
                    throw new AppError('Failed to update quotation items: ' + insertError.message, 500, 'UPDATE_FAILED');
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
                scheduled_start_date: (isNew ? i.scheduledStartDate : i.scheduled_start_date) || null,
                dimensions: i.dimensions || ''
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
                        if (o.dimensions !== n.dimensions) changes['寸法'] = { from: o.dimensions || '空', to: n.dimensions || '空' };

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

        // 先にクライアントにレスポンスを返す
        res.json(updated);

        // 重い事後処理（図面コピー・履歴・監査ログ）はレスポンス後に非同期で実行
        (async () => {
            try {
                // 転用元ファイルの物理コピー (PUT時)
                if (copyFileIds && copyFileIds.length > 0) {
                    console.log(`[Quotations] Background: Copying ${copyFileIds.length} files during update...`);
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

                if (Object.keys(changes).length > 0) {
                    await supabaseAdmin.from('quotation_history').insert({
                        quotation_id: id,
                        tenant_id: req.tenantId,
                        changed_by: req.user.id,
                        change_type: 'updated',
                        changes,
                    });
                }

                await logService.audit({
                    action: 'quotation_updated',
                    entityType: 'quotation',
                    entityId: id,
                    description: `案件情報更新: ${updated.display_id}`,
                    tenantId: req.tenantId,
                    userId: req.userId
                });
            } catch (bgErr) {
                console.error('[Quotations] Background task error (PUT):', bgErr);
            }
        })().catch(err => {
            console.error('[Quotations] Background task error (Outer):', err);
        });

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
/**
 * PATCH /api/quotations/items/:itemId
 * 明細項目の個別更新（日程調整用）
 */
router.patch('/items/:itemId', authMiddleware, async (req, res, next) => {
    try {
        const { itemId } = req.params;
        const { scheduledStartDate, scheduledEndDate, dueDate } = req.body;

        const updates = {};
        if (scheduledStartDate !== undefined) updates.scheduled_start_date = scheduledStartDate;
        if (scheduledEndDate !== undefined) updates.scheduled_end_date = scheduledEndDate;
        if (dueDate !== undefined) updates.due_date = dueDate;

        if (Object.keys(updates).length === 0) {
            return res.json({ message: 'No changes provided' });
        }

        // 既存データの取得（履歴用）
        const { data: existingItem } = await supabaseAdmin
            .from('quotation_items')
            .select('*')
            .eq('id', itemId)
            .eq('tenant_id', req.tenantId)
            .single();

        if (!existingItem) {
            throw new AppError('Item not found', 404, 'NOT_FOUND');
        }

        const { data: updatedItem, error } = await supabaseAdmin
            .from('quotation_items')
            .update(updates)
            .eq('id', itemId)
            .eq('tenant_id', req.tenantId)
            .select('*, quotations(order_number, company_name)')
            .single();

        if (error || !updatedItem) {
            throw new AppError('Failed to update item', 500, 'UPDATE_FAILED');
        }

        // 事後処理
        (async () => {
            try {
                // 変更内容の構築 ({ from: X, to: Y } 形式)
                const changes = {};
                const formatDate = (val) => val ? new Date(val).toLocaleDateString('ja-JP') : 'なし';

                if (scheduledStartDate !== undefined && existingItem.scheduled_start_date !== scheduledStartDate) {
                    changes['着手予定日'] = { 
                        from: formatDate(existingItem.scheduled_start_date), 
                        to: formatDate(scheduledStartDate) 
                    };
                }
                if (scheduledEndDate !== undefined && existingItem.scheduled_end_date !== scheduledEndDate) {
                    changes['完了予定日'] = { 
                        from: formatDate(existingItem.scheduled_end_date), 
                        to: formatDate(scheduledEndDate) 
                    };
                }
                if (dueDate !== undefined && existingItem.due_date !== dueDate) {
                    changes['納期'] = { 
                        from: formatDate(existingItem.due_date), 
                        to: formatDate(dueDate) 
                    };
                }

                if (Object.keys(changes).length > 0) {
                    await supabaseAdmin.from('quotation_history').insert({
                        quotation_id: updatedItem.quotation_id,
                        tenant_id: req.tenantId,
                        changed_by: req.user.id,
                        change_type: 'updated',
                        changes: changes,
                    });
                }

                await logService.audit({
                    action: 'quotation_item_updated',
                    entityType: 'quotation_item',
                    entityId: itemId,
                    description: `案件明細日程更新 (ガント): ${updatedItem.quotations?.order_number || '番号なし'}`,
                    tenantId: req.tenantId,
                    userId: req.userId
                });
            } catch (bgErr) {
                console.error('[Quotations] Background task error (PATCH):', bgErr);
            }
        })();

        res.json(updatedItem);
    } catch (err) {
        next(err);
    }
});

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
        await logService.audit({
            action: 'batch_delivery_executed',
            entityType: 'quotation_item',
            description: `一括納品を実行: ${itemIds.length}件 (納品日: ${deliveryDate})`,
            tenantId: req.tenantId,
            userId: req.userId
        });

        res.json({ message: `${itemIds.length} items delivered`, count: itemIds.length });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/quotations/signed-url
 * 指定されたパスの署名付きURLを生成して返す
 */
router.post('/signed-url', authMiddleware, async (req, res, next) => {
    try {
        const { filePath } = req.body;
        if (!filePath) throw new AppError('File path is required', 400, 'VALIDATION_ERROR');

        // セキュリティチェック: 権限のあるテナントのファイルか確認
        if (!filePath.startsWith(`${req.tenantId}/`)) {
            throw new AppError('Access denied', 403, 'FORBIDDEN');
        }

        const { data, error } = await supabaseAdmin.storage
            .from('quotation-files')
            .createSignedUrl(filePath, 3600); // 1時間有効

        if (error || !data) {
            console.error('[Quotations] Signed URL error:', error);
            throw new AppError('Failed to generate preview URL', 500, 'SIGNED_URL_FAILED');
        }

        res.json({ url: data.signedUrl });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
