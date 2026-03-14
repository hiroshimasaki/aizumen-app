import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Building, Box, Ruler, Hash, Activity } from 'lucide-react';
import api from '../../lib/api';
import { useNotification } from '../../contexts/NotificationContext';

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

    const [globalOverheadFactor, setGlobalOverheadFactor] = useState(1.0);
    const [newEntry, setNewEntry] = useState({
        vendorName: '',
        materialType: '',
        shape: 'plate',
        minDim: 0,
        maxDim: 9999,
        unitPrice: '',
        density: 7.85,
        cuttingCostFactor: 1.0,
    });

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
            console.error('Failed to save global factor:', err);
            await showAlert('保存に失敗しました', 'error');
        }
    };

    const handleMaterialChange = (materialValue) => {
        const material = COMMON_MATERIALS.find(m => m.value === materialValue);
        setNewEntry(prev => ({
            ...prev,
            materialType: materialValue,
            // 「その他」の場合は現在の値を維持、プリセットの場合はその比重をセット
            density: (material && materialValue !== 'OTHER') ? material.density : prev.density
        }));
    };

    const handleAdd = async () => {
        if (!newEntry.vendorName || !newEntry.materialType || !newEntry.unitPrice) {
            await showAlert('必須項目を入力してください', 'error');
            return;
        }

        setSaving(true);
        try {
            await api.post('/api/material-prices', newEntry);
            await showAlert('登録しました', 'success');
            setNewEntry({
                vendorName: '',
                materialType: '',
                shape: 'plate',
                minDim: 0,
                maxDim: 9999,
                unitPrice: '',
                density: 7.85,
                cuttingCostFactor: 1.0,
            });
            fetchPrices();
        } catch (err) {
            console.error('Failed to add price:', err);
            await showAlert('登録に失敗しました', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!(await showConfirm('この設定を削除してもよろしいですか？'))) return;

        try {
            await api.delete(`/api/material-prices/${id}`);
            fetchPrices();
            await showAlert('削除しました', 'success');
        } catch (err) {
            console.error('Failed to delete price:', err);
            await showAlert('削除に失敗しました', 'error');
        }
    };

    if (loading) return <div className="text-slate-400">読み込み中...</div>;

    return (
        <div className="space-y-6">
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                <h3 className="text-lg font-bold text-slate-200 mb-6 flex items-center gap-2">
                    <Plus size={20} className="text-blue-400" />
                    単価設定の追加
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 pl-1 flex items-center gap-1">
                            <Building size={12} /> 業者名
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                list="vendor-list"
                                value={newEntry.vendorName}
                                onChange={e => setNewEntry(prev => ({ ...prev, vendorName: e.target.value }))}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                                placeholder="選択または入力"
                            />
                            <datalist id="vendor-list">
                                {[...new Set(prices.map(p => p.vendor_name))].map(v => (
                                    <option key={v} value={v} />
                                ))}
                            </datalist>
                        </div>
                    </div>
                    <div className="space-y-1.5 relative">
                        <label className="text-xs font-bold text-slate-400 pl-1">材質</label>
                        <select
                            value={COMMON_MATERIALS.some(m => m.value === newEntry.materialType) ? newEntry.materialType : 'OTHER'}
                            onChange={e => handleMaterialChange(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                        >
                            {COMMON_MATERIALS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                        {(newEntry.materialType === 'OTHER' || !COMMON_MATERIALS.some(m => m.value === newEntry.materialType)) && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-10">
                                <input
                                    type="text"
                                    value={newEntry.materialType === 'OTHER' ? '' : newEntry.materialType}
                                    onChange={e => setNewEntry(prev => ({ ...prev, materialType: e.target.value }))}
                                    className="w-full bg-slate-800 border border-blue-500 rounded-lg px-3 py-2 text-sm text-slate-200 shadow-xl outline-none"
                                    placeholder="材質名を入力 (例: SS400-D)"
                                />
                            </div>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 pl-1">形状</label>
                        <select
                            value={newEntry.shape}
                            onChange={e => setNewEntry(prev => ({ ...prev, shape: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                        >
                            {SHAPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 pl-1">比重</label>
                        <input
                            type="number"
                            step="0.01"
                            value={newEntry.density}
                            onChange={e => setNewEntry(prev => ({ ...prev, density: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none font-mono"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 pl-1 flex items-center gap-1">
                            <Ruler size={12} /> サイズ範囲 (mm)
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={newEntry.minDim}
                                onChange={e => setNewEntry(prev => ({ ...prev, minDim: e.target.value }))}
                                className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm text-slate-200 outline-none text-center"
                                placeholder="最小"
                            />
                            <span className="text-slate-600">〜</span>
                            <input
                                type="number"
                                value={newEntry.maxDim}
                                onChange={e => setNewEntry(prev => ({ ...prev, maxDim: e.target.value }))}
                                className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm text-slate-200 outline-none text-center"
                                placeholder="最大"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 pl-1 flex items-center gap-1">
                            <Hash size={12} /> キロ単価 (円/kg)
                        </label>
                        <input
                            type="number"
                            value={newEntry.unitPrice}
                            onChange={e => setNewEntry(prev => ({ ...prev, unitPrice: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none font-mono"
                            placeholder="200"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 pl-1 flex items-center gap-1">
                            切断単価係数
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            value={newEntry.cuttingCostFactor}
                            onChange={e => setNewEntry(prev => ({ ...prev, cuttingCostFactor: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none font-mono"
                            placeholder="1.0"
                        />
                    </div>
                    <div className="md:col-span-1 space-y-1.5 p-4 bg-blue-900/10 rounded-xl border border-blue-800/20">
                        <label className="text-xs font-bold text-blue-300 flex items-center gap-1">
                            <Activity size={12} /> 共通材料管理費係数
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                step="0.01"
                                value={globalOverheadFactor}
                                onChange={e => setGlobalOverheadFactor(e.target.value)}
                                className="w-full bg-slate-900 border border-blue-500/50 rounded-lg px-3 py-1.5 text-sm text-slate-200 outline-none font-mono focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                                onClick={handleSaveGlobalFactor}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg font-bold transition-colors shrink-0"
                            >
                                <Save size={14} />
                            </button>
                        </div>
                        <p className="text-[9px] text-slate-500 leading-tight">全材料に適用されます (ベンダー価格 × 係数)</p>
                    </div>

                    <div className="md:col-span-1 py-0.5 self-end">
                        <button
                            onClick={handleAdd}
                            disabled={saving}
                            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-[9px] rounded-lg font-bold transition-colors disabled:opacity-50"
                        >
                            {saving ? '登録中...' : '単価を追加'}
                        </button>
                    </div>

                    {/* 説明テキストをグリッド外または全幅で表示 */}
                    <div className="md:col-span-4 bg-blue-900/10 border border-blue-800/20 p-3 rounded-lg flex items-start gap-3 mt-4">
                        <Activity size={16} className="text-blue-400 mt-0.5" />
                        <div className="text-[11px] text-slate-400 leading-relaxed">
                            <span className="font-bold text-blue-300">切断費と管理費係数について:</span><br />
                            見積作成時に「切断費 = 基準寸法（板厚や径） × 切断単価係数」として自動加算されます。<br />
                            材料単価は「ベンダー単価 × 材料管理費係数」が見積に反映されます。
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-900/50 border-bottom border-slate-700">
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">業者 / 材質</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">形状 / サイズ範囲</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">単価 / 切断・管理係数</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {prices.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                                    登録された単価はありません
                                </td>
                            </tr>
                        ) : (
                            prices.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-bold text-slate-200">{p.vendor_name}</div>
                                        <div className="text-xs text-slate-400">{p.material_type} (比重: {p.density})</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-slate-200">
                                            {SHAPES.find(s => s.value === p.shape)?.label || p.shape}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            {p.min_dim} 〜 {p.max_dim} mm
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div>
                                            <span className="text-sm font-mono font-bold text-blue-400">¥{Number(p.unit_price).toLocaleString()}</span>
                                            <span className="text-[10px] text-slate-500 ml-1">/{p.base_price_type}</span>
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                            切断係数: <span className="text-blue-300 font-mono">{p.cutting_cost_factor || 0}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(p.id)}
                                            className="text-slate-500 hover:text-red-400 p-2 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
