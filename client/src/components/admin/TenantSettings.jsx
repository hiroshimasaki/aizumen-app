import { useState, useEffect } from 'react';
import { Save, FileJson, Sparkles, ClipboardList, Hash } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';

export default function TenantSettings() {
    const { tenant, setTenant } = useAuth();
    const { showAlert } = useNotification();
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // OCR Mapping
    const [ocrMapping, setOcrMapping] = useState({
        processingCostLabel: '加工費',
        materialCostLabel: '材料費',
        otherCostLabel: 'その他費用',
        itemNameLabel: '品名',
        quantityLabel: '数量',
        deadlineLabel: '納期',
        dimensionsLabel: '寸法',
        orderNumberLabel: '注文番号',
        constructionNumberLabel: '工事番号'
    });
    const [hourlyRate, setHourlyRate] = useState(8000);
    const [autoLostDays, setAutoLostDays] = useState(0);

    useEffect(() => {
        fetchSettings();
        if (tenant?.hourly_rate) {
            setHourlyRate(tenant.hourly_rate);
        }
        if (tenant?.settings?.auto_lost_days) {
            setAutoLostDays(tenant.settings.auto_lost_days);
        }
    }, [tenant]);

    const fetchSettings = async () => {
        try {
            const { data } = await api.get('/api/settings');
            setSettings(data);
            if (data.settings_json?.ocrMapping) {
                setOcrMapping(data.settings_json.ocrMapping);
            }
            // hourly_rateはtenantsテーブル（API側で統合されていればよいが、現状は別途取得か共通tenantデータから）
            // settings取得時にtenants情報も結合されるようにsettings APIを修正するか、AuthContextから持ってくる
            // ここでは簡易的に現在のテナント情報を尊重する
        } catch (err) {
            console.error('Failed to fetch settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updatedJson = {
                ...(settings.settings_json || {}),
                ocrMapping
            };

            await api.put('/api/settings', {
                settingsJson: updatedJson,
                hourlyRate: Number(hourlyRate),
                autoLostDays: Number(autoLostDays)
            });

            // Update local context
            setTenant({
                ...tenant,
                hourly_rate: Number(hourlyRate),
                settings: {
                    ...(tenant.settings || {}),
                    auto_lost_days: Number(autoLostDays)
                }
            });

            await showAlert('設定を保存しました', 'success');
        } catch (err) {
            console.error('Save failed:', err);
            await showAlert('設定の保存に失敗しました', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleMappingChange = (key, value) => {
        setOcrMapping(prev => ({ ...prev, [key]: value }));
    };

    if (loading) return (
        <div className="text-slate-400">
            読み込み中...
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                            <Sparkles size={20} className="text-amber-400" />
                            AI(OCR) 読取項目のマッピング設定
                        </h3>
                        <p className="text-sm text-slate-400 mt-1">
                            自社の図面や注文書で使われている「項目名」と、システムの「データ」を紐づけます。<br />
                            AIはこの設定をヒントに書類から金額や品名を抽出します。<strong>（各項目、カンマ区切りで複数指定可能です）</strong>
                        </p>
                    </div>
                </div>

                <div className="space-y-4 bg-slate-900/50 p-5 rounded-lg border border-slate-700/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
                                <Hash size={14} className="text-amber-400" /> システム側:「注文番号」
                            </label>
                            <input
                                type="text"
                                value={ocrMapping.orderNumberLabel || ''}
                                onChange={e => handleMappingChange('orderNumberLabel', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-amber-500 outline-none placeholder:text-slate-600"
                                placeholder="例: 注文番号, 発注番号, 注文NO"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
                                <ClipboardList size={14} className="text-purple-400" /> システム側:「工事番号」
                            </label>
                            <input
                                type="text"
                                value={ocrMapping.constructionNumberLabel || ''}
                                onChange={e => handleMappingChange('constructionNumberLabel', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-amber-500 outline-none placeholder:text-slate-600"
                                placeholder="例: 工事番号, 図番, 工事NO"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
                                <FileJson size={14} className="text-indigo-400" /> システム側:「品名/図番」
                            </label>
                            <input
                                type="text"
                                value={ocrMapping.itemNameLabel}
                                onChange={e => handleMappingChange('itemNameLabel', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-amber-500 outline-none placeholder:text-slate-600"
                                placeholder="例: 品名, 図番, ProductName"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
                                <FileJson size={14} className="text-rose-400" /> システム側:「寸法」
                            </label>
                            <input
                                type="text"
                                value={ocrMapping.dimensionsLabel || ''}
                                onChange={e => handleMappingChange('dimensionsLabel', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-amber-500 outline-none placeholder:text-slate-600"
                                placeholder="例: 寸法, サイズ, 規格"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
                                <FileJson size={14} className="text-blue-400" /> システム側:「加工費」
                            </label>
                            <input
                                type="text"
                                value={ocrMapping.processingCostLabel}
                                onChange={e => handleMappingChange('processingCostLabel', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-amber-500 outline-none placeholder:text-slate-600"
                                placeholder="例: 加工費, 工賃, 作業代"
                            />

                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
                                <FileJson size={14} className="text-emerald-400" /> システム側:「材料費」
                            </label>
                            <input
                                type="text"
                                value={ocrMapping.materialCostLabel}
                                onChange={e => handleMappingChange('materialCostLabel', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-amber-500 outline-none placeholder:text-slate-600"
                                placeholder="例: 材料費, 部品代, 資材費"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
                                <FileJson size={14} className="text-slate-400" /> システム側:「その他費用」
                            </label>
                            <input
                                type="text"
                                value={ocrMapping.otherCostLabel}
                                onChange={e => handleMappingChange('otherCostLabel', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-amber-500 outline-none placeholder:text-slate-600"
                                placeholder="例: その他費用, 諸経費, 運賃"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
                                <FileJson size={14} className="text-cyan-400" /> システム側:「数量」
                            </label>
                            <input
                                type="text"
                                value={ocrMapping.quantityLabel}
                                onChange={e => handleMappingChange('quantityLabel', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-amber-500 outline-none placeholder:text-slate-600"
                                placeholder="例: 数量, 個数, Qty"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
                                <FileJson size={14} className="text-orange-400" /> システム側:「希望納期」
                            </label>
                            <input
                                type="text"
                                value={ocrMapping.deadlineLabel}
                                onChange={e => handleMappingChange('deadlineLabel', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-amber-500 outline-none placeholder:text-slate-600"
                                placeholder="例: 納期, 希望納期, 納品日"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* コスト計算設定と自動失注設定を並べて配置 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                        <Sparkles size={20} className="text-indigo-400" />
                        コスト計算（標準単価）設定
                    </h3>
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
                            時間単価 (円/時間)
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">¥</span>
                            <input
                                type="number"
                                value={hourlyRate}
                                onChange={(e) => setHourlyRate(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-sm"
                                placeholder="8000"
                            />
                        </div>
                        <p className="text-[10px] text-slate-500">実績工数から加工費を算出する際の基準価格です。</p>
                    </div>
                </div>

                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                        <Sparkles size={20} className="text-rose-400" />
                        自動ステータス更新設定
                    </h3>
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
                            自動失注までの日数 (回答日基準)
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                value={autoLostDays}
                                onChange={(e) => setAutoLostDays(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:ring-2 focus:ring-rose-500/50 outline-none transition-all text-sm"
                                placeholder="0"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs">日経過</span>
                        </div>
                        <p className="text-[10px] text-slate-500">回答日から指定日数が経過した検討中案件を自動で失注扱いにします（0で無効）。</p>
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg shadow-blue-900/20 disabled:opacity-50 transition-all"
                >
                    <Save size={18} />
                    {saving ? '保存中...' : '設定を保存する'}
                </button>
            </div>
        </div >
    );
}
