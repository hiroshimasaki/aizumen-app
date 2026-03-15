import { useState, useEffect, useMemo } from 'react';
import { Save, Plus, Trash2, Building, Box, Ruler, Hash, Activity, X, Edit2, Check } from 'lucide-react';
import api from '../../lib/api';
import { useNotification } from '../../contexts/NotificationContext';
import { cn } from '../../lib/utils';

const SHAPES = [
    { value: 'plate', label: '板材' },
    { value: 'round_bar', label: '丸棒' },
    { value: 'pipe', label: 'パイプ' },
    { value: 'square_pipe', label: '角パイプ' }
];

const COMMON_MATERIALS = [
    { value: 'SS400', label: 'SS400', density: 7.85 },
    { value: 'SUS304', label: 'SUS304', density: 7.93 },
    { label: 'アルミ', value: 'AL', density: 2.7 },
    { label: '真鍮', value: 'BS', density: 8.5 },
    { label: 'その他', value: 'OTHER', density: 7.85 },
];

export default function MaterialPriceMaster() {
    const { showAlert, showConfirm } = useNotification();
    const [prices, setPrices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState(null);

    const [globalOverheadFactor, setGlobalOverheadFactor] = useState(1.0);
    
    // 基本設定
    const [baseConfig, setBaseConfig] = useState({
        vendorName: '',
        materialType: 'SS400',
        shape: 'plate',
        density: 7.85,
        isCustomMaterial: false
    });

    // 入力リスト（一括登録用）
    const [entryRows, setEntryRows] = useState([
        { minDim: '', maxDim: '', unitPrice: '', cuttingCostFactor: 1.0, id: Date.now() }
    ]);

    useEffect(() => {
        fetchPrices();
    }, []);

    const fetchPrices = async () => {
        try {
            const [priceRes, settingsRes] = await Promise.all([
                api.get('/api/material-prices'),
                api.get('/api/settings')
            ]);
            setPrices(priceRes.data);
            if (settingsRes.data?.settings_json?.materialOverheadFactor) {
                setGlobalOverheadFactor(settingsRes.data.settings_json.materialOverheadFactor);
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleBaseChange = (field, value, isFromInput = false) => {
        if (field === 'materialType') {
            if (isFromInput) {
                // テキスト入力欄からの入力時は、モードを「その他」に固定したまま値を更新
                setBaseConfig(prev => ({ ...prev, materialType: value, isCustomMaterial: true }));
            } else {
                // セレクトボックスからの変更時
                const isOther = value === 'OTHER';
                const material = COMMON_MATERIALS.find(m => m.value === value);
                setBaseConfig(prev => ({
                    ...prev,
                    materialType: value,
                    isCustomMaterial: isOther,
                    density: (material && !isOther) ? material.density : prev.density
                }));
            }
        } else {
            setBaseConfig(prev => ({ ...prev, [field]: value }));
        }
    };

    const handleAddRow = () => {
        setEntryRows([...entryRows, { minDim: '', maxDim: '', unitPrice: '', cuttingCostFactor: 1.0, id: Date.now() }]);
    };

    const handleRemoveRow = (id) => {
        if (entryRows.length > 1) {
            setEntryRows(entryRows.filter(r => r.id !== id));
        }
    };

    const handleRowChange = (id, field, value) => {
        setEntryRows(entryRows.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleBatchAdd = async () => {
        const { vendorName, materialType, shape, density } = baseConfig;
        if (!vendorName || !materialType) {
            await showAlert('業者名と材質を入力してください', 'error');
            return;
        }

        const validRows = entryRows.filter(r => r.minDim !== '' && r.maxDim !== '' && r.unitPrice !== '');
        if (validRows.length === 0) {
            await showAlert('少なくとも1件のサイズ・単価を入力してください', 'error');
            return;
        }

        setSaving(true);
        try {
            // 現状のAPIに合わせてループ送信。将来的にbatch APIがあればそちらに移行
            for (const row of validRows) {
                const payload = {
                    vendorName,
                    materialType,
                    shape,
                    density: Number(density),
                    minDim: Number(row.minDim),
                    maxDim: Number(row.maxDim),
                    unitPrice: Number(row.unitPrice),
                    cuttingCostFactor: Number(row.cuttingCostFactor) || 0,
                    basePriceType: 'kg'
                };
                await api.post('/api/material-prices', payload);
            }
            await showAlert(`${validRows.length}件の単価を登録しました`, 'success');
            setEntryRows([{ minDim: '', maxDim: '', unitPrice: '', cuttingCostFactor: 1.0, id: Date.now() }]);
            fetchPrices();
        } catch (err) {
            console.error('Batch add error:', err);
            await showAlert('登録中にエラーが発生しました', 'error');
        } finally {
            setSaving(false);
        }
    };

    // 編集開始
    const startEdit = (p) => {
        setEditingId(p.id);
        setEditForm({ ...p });
    };

    // 編集キャンセル
    const cancelEdit = () => {
        setEditingId(null);
        setEditForm(null);
    };

    // 編集保存
    const handleUpdate = async () => {
        if (!editForm.vendor_name || !editForm.material_type || !editForm.unit_price) {
            await showAlert('必須項目を確認してください', 'error');
            return;
        }

        try {
            await api.put(`/api/material-prices/${editingId}`, {
                vendorName: editForm.vendor_name,
                materialType: editForm.material_type,
                shape: editForm.shape,
                minDim: Number(editForm.min_dim),
                maxDim: Number(editForm.max_dim),
                unitPrice: Number(editForm.unit_price),
                density: Number(editForm.density),
                cuttingCostFactor: Number(editForm.cutting_cost_factor)
            });
            await showAlert('更新しました', 'success');
            setEditingId(null);
            fetchPrices();
        } catch (err) {
            console.error('Update error:', err);
            await showAlert('更新に失敗しました', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!(await showConfirm('この設定を削除してもよろしいですか？'))) return;
        try {
            await api.delete(`/api/material-prices/${id}`);
            fetchPrices();
            await showAlert('削除しました', 'success');
        } catch (err) {
            console.error('Delete error:', err);
            await showAlert('削除に失敗しました', 'error');
        }
    };

    const handleSaveGlobalFactor = async () => {
        try {
            const { data: currentSettings } = await api.get('/api/settings');
            await api.put('/api/settings', {
                settingsJson: {
                    ...(currentSettings.settings_json || {}),
                    materialOverheadFactor: globalOverheadFactor
                }
            });
            await showAlert('共通係数を保存しました', 'success');
        } catch (err) {
            await showAlert('保存に失敗しました', 'error');
        }
    };

    if (loading) return <div className="p-8 text-slate-400">Loading master data...</div>;

    return (
        <div className="space-y-6">
            {/* 一括登録フォーム */}
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Plus size={20} className="text-blue-400" />
                        単価設定の一括登録
                    </h3>
                    <div className="p-3 bg-blue-900/10 rounded-xl border border-blue-800/20 flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-blue-300 uppercase tracking-tighter">材料管理費係数</span>
                            <div className="flex gap-2 mt-1">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={globalOverheadFactor}
                                    onChange={e => setGlobalOverheadFactor(e.target.value)}
                                    className="w-16 bg-slate-900 border border-blue-500/30 rounded px-2 py-1 text-[11px] text-white font-mono"
                                />
                                <button onClick={handleSaveGlobalFactor} className="p-1 bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors">
                                    <Save size={12} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 pb-6 border-b border-slate-700/50">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1"><Building size={10} /> 業者名</label>
                        <input
                            type="text"
                            list="vendor-list"
                            value={baseConfig.vendorName}
                            onChange={e => handleBaseChange('vendorName', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                            placeholder="業者を選択または入力"
                        />
                        <datalist id="vendor-list">
                            {[...new Set(prices.map(p => p.vendor_name))].map(v => <option key={v} value={v} />)}
                        </datalist>
                    </div>

                    <div className="space-y-1.5 relative">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">材質</label>
                        <select
                            value={baseConfig.isCustomMaterial ? 'OTHER' : baseConfig.materialType}
                            onChange={e => handleBaseChange('materialType', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                        >
                            {COMMON_MATERIALS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                        {baseConfig.isCustomMaterial && (
                            <input
                                type="text"
                                value={baseConfig.materialType === 'OTHER' ? '' : baseConfig.materialType}
                                onChange={e => handleBaseChange('materialType', e.target.value, true)}
                                className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 bg-slate-800 border border-blue-500/50 rounded-lg px-3 py-2 text-sm text-white shadow-2xl"
                                placeholder="材質名を入力"
                                autoFocus
                            />
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">形状</label>
                        <select
                            value={baseConfig.shape}
                            onChange={e => handleBaseChange('shape', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                        >
                            {SHAPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">比重 (g/cm³)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={baseConfig.density}
                            onChange={e => handleBaseChange('density', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="grid grid-cols-12 gap-3 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <div className="col-span-4 flex gap-2"><span>最小寸法 (mm)</span><span></span><span>最大寸法 (mm)</span></div>
                        <div className="col-span-3">キロ単価 (円/kg)</div>
                        <div className="col-span-3">切断単価係数</div>
                        <div className="col-span-2"></div>
                    </div>
                    
                    {entryRows.map((row, index) => (
                        <div key={row.id} className="grid grid-cols-12 gap-3 items-center animate-in slide-in-from-left-2 duration-200">
                            <div className="col-span-4 flex items-center gap-2">
                                <input
                                    type="number"
                                    value={row.minDim}
                                    placeholder="0"
                                    onChange={e => handleRowChange(row.id, 'minDim', e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 transition-colors"
                                />
                                <span className="text-slate-600">~</span>
                                <input
                                    type="number"
                                    value={row.maxDim}
                                    placeholder="999"
                                    onChange={e => handleRowChange(row.id, 'maxDim', e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 transition-colors"
                                />
                            </div>
                            <div className="col-span-3">
                                <input
                                    type="number"
                                    value={row.unitPrice}
                                    placeholder="200"
                                    onChange={e => handleRowChange(row.id, 'unitPrice', e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white font-mono"
                                />
                            </div>
                            <div className="col-span-3">
                                <input
                                    type="number"
                                    step="0.1"
                                    value={row.cuttingCostFactor}
                                    onChange={e => handleRowChange(row.id, 'cuttingCostFactor', e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white font-mono"
                                />
                            </div>
                            <div className="col-span-2 flex justify-end gap-2">
                                {entryRows.length > 1 && (
                                    <button onClick={() => handleRemoveRow(row.id)} className="p-2 text-slate-600 hover:text-red-400 transition-colors">
                                        <X size={16} />
                                    </button>
                                )}
                                {index === entryRows.length - 1 && (
                                    <button onClick={handleAddRow} className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                                        <Plus size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-8 flex items-center justify-between">
                    <p className="text-[11px] text-slate-500 flex items-center gap-2">
                        <Activity size={14} className="text-blue-500/50" />
                        同一条件で複数のサイズを一度に登録できます
                    </p>
                    <button
                        onClick={handleBatchAdd}
                        disabled={saving}
                        className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
                    >
                        {saving ? '登録中...' : '単価設定をまとめて保存'}
                    </button>
                </div>
            </div>

            {/* 一覧テーブル */}
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
                <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-900/30">
                    <h4 className="text-sm font-bold text-slate-300 uppercase tracking-widest">登録済み単価リスト</h4>
                    <span className="text-[10px] text-slate-500 font-mono">{prices.length} Records</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/50 border-b border-slate-700">
                                <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase">業者 / 材質</th>
                                <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase">形状 / サイズ範囲</th>
                                <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase text-right">単価 (円)</th>
                                <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase text-right">切断係数</th>
                                <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase text-right w-32">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {prices.map((p) => {
                                const isEditing = editingId === p.id;
                                return (
                                    <tr key={p.id} className={cn(
                                        "transition-colors",
                                        isEditing ? "bg-blue-600/10" : "hover:bg-slate-700/20"
                                    )}>
                                        <td className="px-6 py-4">
                                            {isEditing ? (
                                                <div className="space-y-1">
                                                    <input
                                                        type="text"
                                                        value={editForm.vendor_name}
                                                        onChange={e => setEditForm({ ...editForm, vendor_name: e.target.value })}
                                                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={editForm.material_type}
                                                        onChange={e => setEditForm({ ...editForm, material_type: e.target.value })}
                                                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                                                    />
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="text-sm font-bold text-slate-200">{p.vendor_name}</div>
                                                    <div className="text-[11px] text-slate-500">{p.material_type} (比重: {p.density})</div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {isEditing ? (
                                                <div className="space-y-1">
                                                    <select
                                                        value={editForm.shape}
                                                        onChange={e => setEditForm({ ...editForm, shape: e.target.value })}
                                                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                                                    >
                                                        {SHAPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                                    </select>
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            value={editForm.min_dim}
                                                            onChange={e => setEditForm({ ...editForm, min_dim: e.target.value })}
                                                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white text-center"
                                                        />
                                                        <span className="text-slate-600">-</span>
                                                        <input
                                                            type="number"
                                                            value={editForm.max_dim}
                                                            onChange={e => setEditForm({ ...editForm, max_dim: e.target.value })}
                                                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white text-center"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="text-sm text-slate-200">{SHAPES.find(s => s.value === p.shape)?.label || p.shape}</div>
                                                    <div className="text-[11px] text-slate-500 font-mono">{p.min_dim} 〜 {p.max_dim} mm</div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editForm.unit_price}
                                                    onChange={e => setEditForm({ ...editForm, unit_price: e.target.value })}
                                                    className="w-24 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-right text-blue-400 font-mono font-bold"
                                                />
                                            ) : (
                                                <span className="text-sm font-mono font-extrabold text-blue-400">¥{Number(p.unit_price).toLocaleString()}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={editForm.cutting_cost_factor}
                                                    onChange={e => setEditForm({ ...editForm, cutting_cost_factor: e.target.value })}
                                                    className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-right text-white font-mono"
                                                />
                                            ) : (
                                                <span className="text-sm text-slate-400 font-mono">{p.cutting_cost_factor || 0}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1">
                                                {isEditing ? (
                                                    <>
                                                        <button onClick={handleUpdate} className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded transition-colors">
                                                            <Check size={16} />
                                                        </button>
                                                        <button onClick={cancelEdit} className="p-2 text-slate-400 hover:bg-slate-400/10 rounded transition-colors">
                                                            <X size={16} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => startEdit(p)} className="p-2 text-slate-400 hover:text-blue-400 transition-colors">
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-500 hover:text-red-400 transition-colors">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
