import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Calculator, Search, Check, AlertCircle, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../lib/api';

const SHAPES = [
    { value: 'plate', label: '板材', dims: ['厚み', '幅', '長さ'] },
    { value: 'round_bar', label: '丸棒', dims: ['径', '長さ'] },
    { value: 'pipe', label: 'パイプ', dims: ['外径', '肉厚', '長さ'] },
    { value: 'square_pipe', label: '角パイプ', dims: ['外寸A', '外寸B', '肉厚', '長さ'] }
];

export default function MaterialCostCalcModal({ isOpen, onClose, onApply, initialMetadata }) {
    const [prices, setPrices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [globalOverheadFactor, setGlobalOverheadFactor] = useState(1.0);
    const [htVendors, setHtVendors] = useState([]);
    
    // 材種エントリの配列
    const [entries, setEntries] = useState([
        { id: Date.now(), vendor: '', material: '', shape: 'plate', dims: {}, heatTreatment: { type: 'none', hardness: '', vendor: '', shipToVendor: false }, calculated: { weight: 0, materialCost: 0, cuttingCost: 0, totalCost: 0, unitPrice: 0, density: 0, cuttingFactor: 0 } }
    ]);

    const [expandedEntryId, setExpandedEntryId] = useState(null);

    // 単一エントリの計算ロジック
    const calculateEntryResults = useCallback((entry, currentPrices) => {
        const dimsArr = Object.values(entry.dims).map(v => parseFloat(v) || 0);
        const dimA = dimsArr[0];
        
        if (!entry.material || !entry.shape || !dimA) {
            return { weight: 0, materialCost: 0, cuttingCost: 0, totalCost: 0, unitPrice: 0, density: 0, cuttingFactor: 0 };
        }

        const match = currentPrices.find(p => 
            (!entry.vendor || p.vendor_name === entry.vendor) &&
            p.material_type === entry.material &&
            p.shape === entry.shape &&
            dimA >= Number(p.min_dim) &&
            dimA <= Number(p.max_dim) &&
            p.is_active
        );

        if (!match) {
            return { weight: 0, materialCost: 0, cuttingCost: 0, totalCost: 0, unitPrice: 0, density: 0, cuttingFactor: 0 };
        }

        const density = Number(match.density);
        const unitPrice = Number(match.unit_price);
        const cuttingFactor = Number(match.cutting_cost_factor || 0);
        let weight = 0;

        const v = dimsArr;
        if (entry.shape === 'plate') {
            const [t, w, l] = v;
            weight = (t * (w || 0) * (l || 0) * density) / 1000000;
        } else if (entry.shape === 'round_bar') {
            const [d, l] = v;
            weight = (Math.pow(d / 2, 2) * Math.PI * (l || 0) * density) / 1000000;
        } else if (entry.shape === 'pipe') {
            const [od, t, l] = v;
            const id = od - (t * 2);
            const outerVol = Math.pow(od / 2, 2) * Math.PI * (l || 0);
            const innerVol = Math.pow(id / 2, 2) * Math.PI * (l || 0);
            weight = ((outerVol - innerVol) * density) / 1000000;
        } else if (entry.shape === 'square_pipe') {
            const [a, b, t, l] = v;
            const ia = (a || 0) - (t * 2);
            const ib = (b || 0) - (t * 2);
            const outerArea = (a || 0) * (b || 0);
            const innerArea = ia * ib;
            weight = ((outerArea - innerArea) * (l || 0) * density) / 1000000;
        }

        const rawMaterialCost = weight * unitPrice;
        const rawCuttingCost = dimA * cuttingFactor;
        const entryTotalCost = Math.round(rawMaterialCost + rawCuttingCost);

        return {
            weight: weight.toFixed(3),
            materialCost: Math.round(rawMaterialCost),
            cuttingCost: Math.round(rawCuttingCost),
            totalCost: entryTotalCost,
            unitPrice: unitPrice,
            density: density,
            cuttingFactor: cuttingFactor
        };
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchPrices();
            // 初期データの復元
            if (initialMetadata) {
                const normalizedEntries = Array.isArray(initialMetadata) 
                    ? initialMetadata 
                    : initialMetadata.entries 
                        ? initialMetadata.entries 
                        : [initialMetadata];

                setEntries(normalizedEntries.map((e, idx) => ({
                    ...e,
                    id: e.id || Date.now() + idx,
                    dims: e.dims || {},
                    heatTreatment: e.heatTreatment || { type: 'none', hardness: '', vendor: '', shipToVendor: false },
                    calculated: e.calculated || { weight: 0, materialCost: 0, cuttingCost: 0, totalCost: 0, unitPrice: 0, density: 0, cuttingFactor: 0 }
                })));
                setExpandedEntryId(normalizedEntries[0]?.id || Date.now());
            } else {
                const firstId = Date.now();
                setEntries([
                    { id: firstId, vendor: '', material: '', shape: 'plate', dims: {}, heatTreatment: { type: 'none', hardness: '', vendor: '', shipToVendor: false }, calculated: { weight: 0, materialCost: 0, cuttingCost: 0, totalCost: 0, unitPrice: 0, density: 0, cuttingFactor: 0 } }
                ]);
                setExpandedEntryId(firstId);
            }
        }
    }, [isOpen]); // initialMetadataを依存に含めると編集中にリセットされる可能性があるため外す

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
        
        try {
            const quotationsRes = await api.get('/api/quotations');
            const vendors = new Set();
            const qList = Array.isArray(quotationsRes.data) ? quotationsRes.data : (quotationsRes.data?.data || []);
            qList.forEach(q => {
                (q.items || []).forEach(item => {
                    const htMeta = item.material_metadata;
                    const ent = Array.isArray(htMeta) ? htMeta : (htMeta?.entries || (htMeta ? [htMeta] : []));
                    ent.forEach(e => {
                        const htVendor = e.heatTreatment?.vendor;
                        if (htVendor) vendors.add(htVendor);
                    });
                });
            });
            setHtVendors(Array.from(vendors));
        } catch (e) {
            console.error('Failed to fetch HT vendors:', e);
        }
    };

    // マスタ更新時に全再計算
    useEffect(() => {
        if (prices.length > 0) {
            setEntries(prev => prev.map(e => ({
                ...e,
                calculated: calculateEntryResults(e, prices)
            })));
        }
    }, [prices, globalOverheadFactor, calculateEntryResults]);

    const vendors = [...new Set(prices.map(p => p.vendor_name))];

    const addEntry = () => {
        const newId = Date.now();
        setEntries(prev => [...prev, {
            id: newId, vendor: '', material: '', shape: 'plate', dims: {}, heatTreatment: { type: 'none', hardness: '', vendor: '', shipToVendor: false }, calculated: { weight: 0, materialCost: 0, cuttingCost: 0, totalCost: 0, unitPrice: 0, density: 0, cuttingFactor: 0 }
        }]);
        setExpandedEntryId(newId);
    };

    const removeEntry = (id) => {
        if (entries.length > 1) {
            setEntries(prev => prev.filter(e => e.id !== id));
        }
    };

    // 入力更新関数（同時に計算も行う）
    const updateEntry = (id, field, value) => {
        setEntries(prev => prev.map(e => {
            if (e.id === id) {
                const updated = { ...e, [field]: value };
                return { ...updated, calculated: calculateEntryResults(updated, prices) };
            }
            return e;
        }));
    };

    const updateHT = (id, field, value) => {
        setEntries(prev => prev.map(e => e.id === id ? { 
            ...e, 
            heatTreatment: { ...e.heatTreatment, [field]: value } 
        } : e));
    };

    const updateDims = (id, dim, value) => {
        setEntries(prev => prev.map(e => {
            if (e.id === id) {
                const updated = { ...e, dims: { ...e.dims, [dim]: value } };
                return { ...updated, calculated: calculateEntryResults(updated, prices) };
            }
            return e;
        }));
    };

    // 合計値の算出
    const totalWeight = entries.reduce((sum, e) => sum + parseFloat(e.calculated.weight || 0), 0).toFixed(3);
    const totalRawCost = entries.reduce((sum, e) => sum + e.calculated.totalCost, 0);
    const finalTotalCost = Math.round(totalRawCost * globalOverheadFactor);

    const handleApply = () => {
        onApply({
            cost: finalTotalCost,
            metadata: {
                entries: entries.map(e => ({
                    vendor: e.vendor,
                    material: e.material,
                    shape: e.shape,
                    dims: e.dims,
                    weight: e.calculated.weight,
                    materialCost: e.calculated.materialCost,
                    cuttingCost: e.calculated.cuttingCost,
                    unitPrice: e.calculated.unitPrice,
                    density: e.calculated.density,
                    cuttingFactor: e.calculated.cuttingFactor,
                    heatTreatment: e.heatTreatment
                })),
                totalWeight,
                overheadFactor: globalOverheadFactor
            }
        });
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Calculator className="text-blue-400" size={24} />
                        材料費自動計算 (複数材料対応)
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                    {entries.map((entry, index) => {
                        const isExpanded = expandedEntryId === entry.id;
                        const entryMaterials = [...new Set(prices.filter(p => !entry.vendor || p.vendor_name === entry.vendor).map(p => p.material_type))];
                        const currentShape = SHAPES.find(s => s.value === entry.shape);

                        return (
                            <div key={entry.id} className={cn(
                                "border rounded-xl transition-all duration-200 overflow-hidden",
                                isExpanded ? "border-blue-500/50 bg-slate-800/40" : "border-slate-700 bg-slate-800/20 hover:bg-slate-800/30"
                            )}>
                                <div 
                                    className="px-4 py-3 flex items-center justify-between cursor-pointer"
                                    onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
                                            {index + 1}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-200">
                                                {entry.material || '材料未選択'} {entry.shape && `(${SHAPES.find(s => s.value === entry.shape)?.label})`}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                {entry.calculated.weight}kg | ¥{entry.calculated.totalCost.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {entries.length > 1 && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); removeEntry(entry.id); }}
                                                className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                        {isExpanded ? <ChevronUp size={20} className="text-slate-500" /> : <ChevronDown size={20} className="text-slate-500" />}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="p-4 border-t border-slate-700/50 space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400">業者</label>
                                                <select
                                                    value={entry.vendor}
                                                    onChange={e => updateEntry(entry.id, 'vendor', e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none"
                                                >
                                                    <option value="">指定なし</option>
                                                    {vendors.map(v => <option key={v} value={v}>{v}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400">形状</label>
                                                <select
                                                    value={entry.shape}
                                                    onChange={e => {
                                                        const id = entry.id;
                                                        const val = e.target.value;
                                                        setEntries(prev => prev.map(e => {
                                                            if (e.id === id) {
                                                                const updated = { ...e, shape: val, dims: {} };
                                                                return { ...updated, calculated: calculateEntryResults(updated, prices) };
                                                            }
                                                            return e;
                                                        }));
                                                    }}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none"
                                                >
                                                    {SHAPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1 col-span-2">
                                                <label className="text-[10px] font-bold text-slate-400">材質</label>
                                                <select
                                                    value={entry.material}
                                                    onChange={e => updateEntry(entry.id, 'material', e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none"
                                                >
                                                    <option value="">材質を選択してください</option>
                                                    {entryMaterials.map(m => <option key={m} value={m}>{m}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 grid grid-cols-4 gap-3">
                                            {currentShape.dims.map((dim) => (
                                                <div key={dim} className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500">{dim}</label>
                                                    <input
                                                        type="number"
                                                        value={entry.dims[dim] || ''}
                                                        onChange={e => updateDims(entry.id, dim, e.target.value)}
                                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-center text-slate-200 outline-none"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <div className="bg-slate-900/30 p-3 rounded-lg border border-slate-700/50 grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-slate-500">熱処理 (N/H)</label>
                                                <select
                                                    value={entry.heatTreatment.type}
                                                    onChange={e => updateHT(entry.id, 'type', e.target.value)}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none"
                                                >
                                                    <option value="none">なし</option>
                                                    <option value="N">N (焼きならし)</option>
                                                    <option value="H">H (焼き入れ)</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-slate-500">目標硬度</label>
                                                <input
                                                    type="text"
                                                    value={entry.heatTreatment.hardness}
                                                    onChange={e => updateHT(entry.id, 'hardness', e.target.value)}
                                                    disabled={entry.heatTreatment.type === 'none'}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none disabled:opacity-30"
                                                    placeholder="50±2"
                                                />
                                            </div>
                                            <div className="space-y-1 col-span-2">
                                                <label className="text-[9px] font-bold text-slate-500">熱処理委託先</label>
                                                <input
                                                    type="text"
                                                    list="ht-vendor-list"
                                                    value={entry.heatTreatment.vendor}
                                                    onChange={e => updateHT(entry.id, 'vendor', e.target.value)}
                                                    disabled={entry.heatTreatment.type === 'none'}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none disabled:opacity-30"
                                                />
                                            </div>
                                            <div className="col-span-2 flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        id={`ship-${entry.id}`}
                                                        checked={entry.heatTreatment.shipToVendor}
                                                        onChange={e => updateHT(entry.id, 'shipToVendor', e.target.checked)}
                                                        disabled={entry.heatTreatment.type === 'none'}
                                                        className="w-3 h-3 rounded"
                                                    />
                                                    <label htmlFor={`ship-${entry.id}`} className="text-[10px] text-slate-400 cursor-pointer">
                                                        熱処理先へ直送
                                                    </label>
                                                </div>
                                                <div className="flex items-center gap-2 border-t border-slate-700/50 pt-2">
                                                    <input
                                                        type="checkbox"
                                                        id={`record-${entry.id}`}
                                                        checked={entry.heatTreatment.record}
                                                        onChange={e => updateHT(entry.id, 'record', e.target.checked)}
                                                        disabled={entry.heatTreatment.type === 'none'}
                                                        className="w-3 h-3 rounded"
                                                    />
                                                    <label htmlFor={`record-${entry.id}`} className="text-[10px] text-red-400 font-bold cursor-pointer">
                                                        熱処理記録（成績書）が必要
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <button
                        onClick={addEntry}
                        className="w-full py-3 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 font-bold hover:border-slate-500 hover:text-slate-300 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <Plus size={18} />
                        別の材料を追加
                    </button>
                </div>

                <div className="p-6 bg-slate-900 border-t border-slate-800 space-y-4">
                    <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-xl flex items-center justify-between">
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">合計計算結果</span>
                            <div className="text-xs text-slate-400 flex gap-3">
                                <span>総重量: <strong>{totalWeight}kg</strong></span>
                                <span>材料原価合計: <strong>¥{totalRawCost.toLocaleString()}</strong></span>
                                <span>管理費係数: <strong>{globalOverheadFactor}</strong></span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] text-slate-500 mb-0.5">材料費計 (管理費込・税込)</div>
                            <div className="text-3xl font-black text-blue-400 font-mono">
                                <span className="text-lg mr-1">¥</span>
                                {finalTotalCost.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 font-bold hover:bg-slate-800 transition-all"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleApply}
                            disabled={finalTotalCost === 0}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-30"
                        >
                            <Check size={18} />
                            見積に反映する
                        </button>
                    </div>
                </div>
            </div>
            <datalist id="ht-vendor-list">
                {htVendors.map(v => <option key={v} value={v} />)}
            </datalist>
        </div>,
        document.body
    );
}

function cn(...classes) {
    return classes.filter(Boolean).join(' ');
}
