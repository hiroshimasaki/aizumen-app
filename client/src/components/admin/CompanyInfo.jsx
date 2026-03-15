import { useState, useEffect } from 'react';
import { Building, Save as SafeIcon, Globe, Mail, Phone, MapPin, LayoutGrid, Check, Palette, Sparkles } from 'lucide-react';
import { Save, RefreshCw } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';

export default function CompanyInfo() {
    const { tenant, setTenant } = useAuth();
    const { showAlert } = useNotification();
    const [name, setName] = useState(tenant?.name || '');
    const [address, setAddress] = useState(tenant?.address || '');
    const [phone, setPhone] = useState(tenant?.phone || '');
    const [website, setWebsite] = useState(tenant?.website || '');
    const [zip, setZip] = useState(tenant?.zip || '');
    const [fax, setFax] = useState(tenant?.fax || '');
    const [email, setEmail] = useState(tenant?.email || '');
    const savedTheme = tenant?.theme_type || tenant?.settings?.theme_type || 'industrial';
    const [themeType, setThemeType] = useState(savedTheme);
    const [saving, setSaving] = useState(false);

    const THEMES = [
        { id: 'industrial', label: 'Industrial', primary: '#3b82f6', accent: '#0891b2', bg: '#0c0e14', desc: '標準デザイン (CUD 調整済み)' },
        { id: 'midnight', label: 'CUD Deep Blue', primary: '#2d6ae5', accent: '#f59e0b', bg: '#0a0c10', desc: '青とオレンジの識別しやすい組み合わせ' },
        { id: 'forest', label: 'CUD Earth', primary: '#1aaf8b', accent: '#a855f7', bg: '#060908', desc: '自然な色合いで赤緑混同に配慮' },
        { id: 'purple', label: 'High Contrast', primary: '#fbbf24', accent: '#3b82f6', bg: '#000000', desc: '黄と青の最大明度差を確保' },
        { id: 'crimson', label: 'CUD Vivid', primary: '#ff4b00', accent: '#0ea5e9', bg: '#0d0505', desc: '朱色とスカイブルーの推奨ペア' },
    ];

    useEffect(() => {
        if (tenant) {
            setName(tenant.name || '');
            setAddress(tenant.address || '');
            setPhone(tenant.phone || '');
            setWebsite(tenant.website || '');
            setZip(tenant.zip || '');
            setFax(tenant.fax || '');
            setEmail(tenant.email || '');
            const currentTheme = tenant.theme_type || tenant.settings?.theme_type || 'industrial';
            setThemeType(currentTheme);
        }
    }, [tenant]);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put('/api/settings/company', {
                name, address, phone, website,
                zip, fax, email, themeType
            });
            setTenant({
                ...tenant,
                name, address, phone, website,
                zip, fax, email,
                settings: {
                    ...(tenant.settings || {}),
                    theme_type: themeType
                }
            });
            await showAlert('企業情報を更新しました。', 'success');
        } catch (err) {
            console.error('Failed to update company info:', err);
            await showAlert('更新に失敗しました。', 'error');
        } finally {
            setSaving(false);
        }
    };

    const isChanged =
        name !== (tenant?.name || '') ||
        address !== (tenant?.address || '') ||
        phone !== (tenant?.phone || '') ||
        website !== (tenant?.website || '') ||
        zip !== (tenant?.zip || '') ||
        fax !== (tenant?.fax || '') ||
        email !== (tenant?.email || '') ||
        themeType !== savedTheme;



    return (
        <div className="space-y-6">
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 backdrop-blur-md">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-blue-500/20 rounded-2xl">
                        <Building size={32} className="text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">企業情報の管理</h3>
                        <p className="text-sm text-slate-400">システム全体に表示される基本情報を設定します。</p>
                    </div>
                </div>

                <form onSubmit={handleSave} className="space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
                            企業名 / テナント名
                        </label>
                        <div className="relative">
                            <Building size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                placeholder="株式会社 〇〇"
                            />
                        </div>
                    </div>

                    {/* Address Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-1 space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
                                郵便番号
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">〒</span>
                                <input
                                    type="text"
                                    value={zip}
                                    onChange={(e) => setZip(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                    placeholder="123-4567"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
                                住所
                            </label>
                            <div className="relative">
                                <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                    placeholder="東京都〇〇区..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
                                電話番号
                            </label>
                            <div className="relative">
                                <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                    placeholder="03-xxxx-xxxx"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
                                FAX番号
                            </label>
                            <div className="relative">
                                <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 rotate-90" />
                                <input
                                    type="text"
                                    value={fax}
                                    onChange={(e) => setFax(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                    placeholder="03-xxxx-xxxx"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Online Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
                                Webサイト
                            </label>
                            <div className="relative">
                                <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    value={website}
                                    onChange={(e) => setWebsite(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                    placeholder="https://..."
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
                                代表メールアドレス
                            </label>
                            <div className="relative">
                                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                    placeholder="info@example.com"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Theme Selection */}
                    <div className="space-y-4 pt-4">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
                                画面カラーテーマ
                            </label>
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest">
                                Accessibility
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed flex items-start gap-2 max-w-2xl pl-1">
                            <Sparkles size={14} className="text-amber-400 shrink-0 mt-0.5" />
                            <span>
                                多様な色覚（P型・D型等）を持つユーザーが情報を識別しやすいよう、カラーユニバーサルデザイン（CUD）に配慮した配色を採用しています。
                            </span>
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {THEMES.map((theme) => (
                                <button
                                    key={theme.id}
                                    type="button"
                                    onClick={() => setThemeType(theme.id)}
                                    className={`relative flex flex-col items-start p-4 rounded-2xl border transition-all text-left group ${themeType === theme.id
                                        ? 'bg-white/5 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                                        : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'
                                        }`}
                                >
                                    <div className="flex items-center justify-between w-full mb-3">
                                        <div className="flex gap-1.5">
                                            <div 
                                                className="w-4 h-4 rounded-full shadow-sm" 
                                                style={{ backgroundColor: theme.primary }} 
                                            />
                                            <div 
                                                className="w-4 h-4 rounded-full shadow-sm" 
                                                style={{ backgroundColor: theme.accent }} 
                                            />
                                        </div>
                                        {themeType === theme.id && (
                                            <div className="bg-blue-500 rounded-full p-1 scale-110">
                                                <Check size={10} className="text-white" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="font-bold text-sm text-white mb-1">{theme.label}</div>
                                    <div className="text-[10px] text-slate-500 leading-tight">{theme.desc}</div>
                                    
                                    {/* Preview Box */}
                                    <div 
                                        className="mt-3 w-full h-12 rounded-lg border border-white/5 relative overflow-hidden"
                                        style={{ backgroundColor: theme.bg }}
                                    >
                                        <div className="absolute top-2 left-2 w-8 h-1 rounded-full opacity-40" style={{ backgroundColor: theme.primary }} />
                                        <div className="absolute top-4 left-2 w-12 h-1 rounded-full opacity-20" style={{ backgroundColor: theme.primary }} />
                                        <div className="absolute bottom-2 right-2 w-4 h-4 rounded shadow-inner" style={{ backgroundColor: theme.accent }} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>


                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={saving || !isChanged}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all active:scale-95"
                        >
                            <Save size={20} />
                            {saving ? '保存中...' : '変更を保存する'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl flex gap-3 text-xs text-slate-400">
                <MapPin size={16} className="shrink-0 text-slate-500" />
                <p>
                    企業情報（名称・住所・連絡先・メール）の変更は、請求書や見積書PDFの出力内容に反映されます。<br />
                    ドメイン名の変更やテナントの削除が必要な場合は、システム管理までお問い合わせください。
                </p>
            </div>
        </div >
    );
}
