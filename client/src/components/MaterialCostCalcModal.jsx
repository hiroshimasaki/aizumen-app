import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calculator, Search, Check, AlertCircle } from 'lucide-react';
import api from '../lib/api';

const SHAPES = [
    { value: 'plate', label: '板材', dims: ['厚み', '幅', '長さ'] },
    { value: 'round_bar', label: '丸棒', dims: ['径', '長さ'] },
    { value: 'pipe', label: 'パイプ', dims: ['外径', '肉厚', '長さ'] },
    { value: 'square_pipe', label: '角パイプ', dims: ['外寸A', '外寸B', '肉厚', '長さ'] }
];

export default function MaterialCostCalcModal({ isOpen, onClose, onApply }) {
    const [prices, setPrices] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [vendor, setVendor] = useState('');
    const [material, setMaterial] = useState('');
    const [shape, setShape] = useState('plate');
    const [dimValues, setDimValues] = useState({});
    const [globalOverheadFactor, setGlobalOverheadFactor] = useState(1.0);
    const [htVendors, setHtVendors] = useState([]);
    // 熱処理情報
    const [heatTreatment, setHeatTreatment] = useState({ type: 'none', hardness: '', vendor: '', shipToVendor: false });
    // 計算結果
    const [calculated, setCalculated] = useState({ weight: 0, materialCost: 0, cuttingCost: 0, totalCost: 0, unitPrice: 0, density: 0, cuttingFactor: 0, overheadFactor: 1.0 });

    useEffect(() => {
        if (isOpen) {
            fetchPrices();
        }
    }, [isOpen]);

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
        
        // 熱処理業者の履歴を取得
        try {
            const quotationsRes = await api.get('/api/quotations');
            const vendors = new Set();
            (quotationsRes.data || []).forEach(q => {
                (q.items || []).forEach(item => {
                    const htVendor = item.material_metadata?.heatTreatment?.vendor;
                    if (htVendor) vendors.add(htVendor);
                });
            });
            setHtVendors(Array.from(vendors));
        } catch (e) {
            console.error('Failed to fetch HT vendors:', e);
        }
    };

    // フィルタリングされた業者一覧
    const vendors = [...new Set(prices.map(p => p.vendor_name))];
    // 選択された業者に紐づく材質一覧
    const materials = [...new Set(prices.filter(p => !vendor || p.vendor_name === vendor).map(p => p.material_type))];

    // 計算実行
    useEffect(() => {
        const dims = Object.values(dimValues).map(v => parseFloat(v) || 0);
        const dimA = dims[0]; // 板厚/径/外径/外寸A
        if (!material || !shape || !dimA) {
            setCalculated({ weight: 0, materialCost: 0, cuttingCost: 0, totalCost: 0, unitPrice: 0, density: 0, cuttingFactor: 0, overheadFactor: 1.0 });
            return;
        }

        // マスタから条件に合うものを探す (業者、材質、形状、寸法範囲)
        const match = prices.find(p => 
            (!vendor || p.vendor_name === vendor) &&
            p.material_type === material &&
            p.shape === shape &&
            dimA >= Number(p.min_dim) &&
            dimA <= Number(p.max_dim) &&
            p.is_active
        );

        if (!match) {
            setCalculated({ weight: 0, materialCost: 0, cuttingCost: 0, totalCost: 0, unitPrice: 0, density: 0, cuttingFactor: 0, overheadFactor: 1.0 });
            return;
        }

        const density = Number(match.density);
        const unitPrice = Number(match.unit_price);
        const cuttingFactor = Number(match.cutting_cost_factor || 0);
        const overheadFactor = globalOverheadFactor;
        let weight = 0;

        const v = dims;

        if (shape === 'plate') {
            const [t, w, l] = v;
            weight = (t * w * l * density) / 1000000;
        } else if (shape === 'round_bar') {
            const [d, l] = v;
            weight = (Math.pow(d / 2, 2) * Math.PI * l * density) / 1000000;
        } else if (shape === 'pipe') {
            const [od, t, l] = v;
            const id = od - (t * 2);
            const outerVol = Math.pow(od / 2, 2) * Math.PI * l;
            const innerVol = Math.pow(id / 2, 2) * Math.PI * l;
            weight = ((outerVol - innerVol) * density) / 1000000;
        } else if (shape === 'square_pipe') {
            const [a, b, t, l] = v;
            const ia = a - (t * 2);
            const ib = b - (t * 2);
            const outerArea = a * b;
            const innerArea = ia * ib;
            weight = ((outerArea - innerArea) * l * density) / 1000000;
        }

        const rawMaterialCost = weight * unitPrice;
        const rawCuttingCost = dimA * cuttingFactor;
        const totalCost = Math.round((rawMaterialCost + rawCuttingCost) * overheadFactor);

        setCalculated({
            weight: weight.toFixed(3),
            materialCost: Math.round(rawMaterialCost),
            cuttingCost: Math.round(rawCuttingCost),
            totalCost: totalCost,
            unitPrice: unitPrice,
            density: density,
            cuttingFactor: cuttingFactor,
            overheadFactor: overheadFactor
        });

    }, [vendor, material, shape, dimValues, prices, globalOverheadFactor]);

    const handleApply = () => {
        onApply({
            cost: calculated.totalCost,
            metadata: {
                vendor,
                material,
                shape,
                dims: dimValues,
                weight: calculated.weight,
                materialCost: calculated.materialCost,
                cuttingCost: calculated.cuttingCost,
                unitPrice: calculated.unitPrice,
                density: calculated.density,
                cuttingFactor: calculated.cuttingFactor,
                overheadFactor: calculated.overheadFactor,
                heatTreatment // 熱処理情報をメタデータに追加
            }
        });
        onClose();
    };

    if (!isOpen) return null;

    const currentShape = SHAPES.find(s => s.value === shape);

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Calculator className="text-blue-400" size={24} />
                        材料費自動計算
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400">業者</label>
                            <select
                                value={vendor}
                                onChange={e => setVendor(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                            >
                                <option value="">指定なし</option>
                                {vendors.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400">形状</label>
                            <select
                                value={shape}
                                onChange={e => {
                                    setShape(e.target.value);
                                    setDimValues({});
                                }}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                            >
                                {SHAPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5 col-span-2">
                            <label className="text-xs font-bold text-slate-400">材質</label>
                            <select
                                value={material}
                                onChange={e => setMaterial(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                            >
                                <option value="">材質を選択してください</option>
                                {materials.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700/50">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">寸法入力 (mm)</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {currentShape.dims.map((dim, i) => (
                                <div key={dim} className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400">{dim}</label>
                                    <input
                                        type="number"
                                        value={dimValues[dim] || ''}
                                        onChange={e => setDimValues(prev => ({ ...prev, [dim]: e.target.value }))}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm text-center text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="0"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-800/30 p-5 rounded-xl border border-slate-700/50 space-y-4">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                             熱処理設定
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400">種類 (N/H)</label>
                                <select
                                    value={heatTreatment.type}
                                    onChange={e => setHeatTreatment(prev => ({ ...prev, type: e.target.value }))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                                >
                                    <option value="none">なし</option>
                                    <option value="N">N (焼きならし)</option>
                                    <option value="H">H (焼き入れ)</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400">目標硬度 (HRC等)</label>
                                <input
                                    type="text"
                                    value={heatTreatment.hardness}
                                    onChange={e => setHeatTreatment(prev => ({ ...prev, hardness: e.target.value }))}
                                    disabled={heatTreatment.type === 'none'}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none disabled:opacity-30"
                                    placeholder="例: 50±2"
                                />
                            </div>
                            <div className="space-y-1.5 col-span-2">
                                <label className="text-[10px] font-bold text-slate-400">熱処理委託先</label>
                                <input
                                    type="text"
                                    list="ht-vendor-list"
                                    value={heatTreatment.vendor}
                                    onChange={e => setHeatTreatment(prev => ({ ...prev, vendor: e.target.value }))}
                                    disabled={heatTreatment.type === 'none'}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none disabled:opacity-30"
                                    placeholder="熱処理業者名を入力または選択"
                                />
                                <datalist id="ht-vendor-list">
                                    {htVendors.map(v => <option key={v} value={v} />)}
                                </datalist>
                            </div>
                            <div className="col-span-2 flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="shipToVendor"
                                    checked={heatTreatment.shipToVendor}
                                    onChange={e => setHeatTreatment(prev => ({ ...prev, shipToVendor: e.target.checked }))}
                                    disabled={heatTreatment.type === 'none'}
                                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 disabled:opacity-30"
                                />
                                <label htmlFor="shipToVendor" className="text-xs text-slate-400 cursor-pointer select-none disabled:opacity-30">
                                    鋼材を熱処理業者へ直送する
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-600/10 border border-blue-500/20 p-5 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-blue-300 tracking-wider">計算結果</span>
                            {calculated.totalCost === 0 && material && (
                                <div className="flex items-center gap-1 text-[10px] text-amber-400">
                                    <AlertCircle size={10} />
                                    <span>マスタに単価がありません</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-end justify-between">
                            <div className="space-y-1">
                                <div className="text-[10px] text-slate-500">重量 / 単価 / 切断費</div>
                                <div className="text-xs font-bold text-slate-300">
                                    {calculated.weight} <span className="text-[9px] font-normal">kg</span>
                                    <span className="mx-2 text-slate-700">|</span>
                                    <span className="text-blue-400">¥{calculated.unitPrice.toLocaleString()}</span><span className="text-[9px] font-normal">/kg</span>
                                    <span className="mx-2 text-slate-700">|</span>
                                    <span className="text-emerald-400">係 {calculated.overheadFactor}</span>
                                    <span className="mx-2 text-slate-700">|</span>
                                    <span className="text-amber-400">切 ¥{calculated.cuttingCost.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] text-slate-500 mb-0.5">材料費合計 (切断費込)</div>
                                <div className="text-3xl font-black text-blue-400 font-mono">
                                    <span className="text-lg mr-1">¥</span>
                                    {calculated.totalCost.toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-900 border-t border-slate-800 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 font-bold hover:bg-slate-800 transition-all"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={calculated.totalCost === 0}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-30"
                    >
                        <Check size={18} />
                        見積に反映する
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
