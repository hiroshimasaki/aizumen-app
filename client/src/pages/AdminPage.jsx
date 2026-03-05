import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users, Settings, Building, Zap, ChevronRight, Database } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import UserManagement from '../components/admin/UserManagement';
import TenantSettings from '../components/admin/TenantSettings';
import Billing from '../components/admin/Billing';
import CompanyInfo from '../components/admin/CompanyInfo';
import DataManagement from '../components/admin/DataManagement';

const ALL_TABS = [
    { id: 'users', label: 'ユーザー管理', icon: Users, desc: '招待や権限の設定', roles: ['system_admin'] },
    { id: 'settings', label: 'テナント設定', icon: Settings, desc: 'AI OCRのマッピング等', roles: ['admin', 'system_admin'] },
    { id: 'billing', label: 'プラン・クレジット', icon: Zap, desc: 'ご契約状況の確認', roles: ['system_admin'] },
    { id: 'company', label: '企業情報', icon: Building, desc: '基本情報の変更', roles: ['admin', 'system_admin'] },
    { id: 'data', label: 'データ管理', icon: Database, desc: 'エクスポート・バックアップ', roles: ['system_admin'] }
];

export default function AdminPage() {
    const { tenant, userRole } = useAuth();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('users');

    const navigate = useNavigate();

    const tabs = ALL_TABS.filter(tab => tab.roles.includes(userRole));

    // URLパラメータと内部状態を同期する単一のEffect
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tabParam = params.get('tab');

        // タブが権限内かチェック
        if (tabParam && tabs.some(t => t.id === tabParam)) {
            if (activeTab !== tabParam) {
                setActiveTab(tabParam);
            }
        } else if (tabs.length > 0) {
            // URLにタブがない、または権限外の場合はデフォルト（最初の選択肢）へ
            const defaultTab = tabs[0].id;
            if (activeTab !== defaultTab) {
                setActiveTab(defaultTab);
            }
        }
    }, [location.search, userRole, tabs.length]); // tabs.lengthが変わった時だけ再チェック

    return (
        <div className="flex flex-col md:flex-row gap-6">
            {/* Sidebar */}
            <aside className="w-full md:w-64 shrink-0 space-y-6">
                <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700 backdrop-blur-sm">
                    <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mb-1">
                        <Settings className="text-blue-400" />
                        管理者設定
                    </h2>
                    <p className="text-xs text-slate-400">{tenant?.name}</p>
                </div>

                <nav className="space-y-1">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => navigate(`/admin?tab=${tab.id}`)}
                                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${isActive
                                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 shadow-sm'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${isActive ? 'bg-blue-500/20' : 'bg-slate-800/50'}`}>
                                        <Icon size={18} />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-sm font-bold">{tab.label}</div>
                                        <div className="text-[10px] opacity-70">{tab.desc}</div>
                                    </div>
                                </div>
                                <ChevronRight size={16} className={`transition-transform ${isActive ? 'text-blue-400' : 'text-slate-600'}`} />
                            </button>
                        );
                    })}
                </nav>
            </aside>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
                {activeTab === 'users' && <UserManagement />}
                {activeTab === 'settings' && <TenantSettings />}
                {activeTab === 'billing' && <Billing />}
                {activeTab === 'company' && <CompanyInfo />}
                {activeTab === 'data' && <DataManagement />}
            </div>
        </div>
    );
}
