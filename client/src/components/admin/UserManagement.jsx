import { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, CheckCircle, XCircle, Copy, Key, Eye, EyeOff, Building2, Info, RefreshCw, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';

export default function UserManagement() {
    const { user, tenant, userRole } = useAuth();
    const { showAlert, showConfirm } = useNotification();
    const isSystemAdmin = userRole === 'system_admin';
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmployeeId, setInviteEmployeeId] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [inviteRole, setInviteRole] = useState('user');
    const [inviting, setInviting] = useState(false);
    const [maxUsers, setMaxUsers] = useState(1);
    const [createdCredentials, setCreatedCredentials] = useState(null); // { employeeId, name, tempPassword }
    const [showPassword, setShowPassword] = useState(false);

    // パスワード手動設定用モーダルの状態
    const [resettingUser, setResettingUser] = useState(null);
    const [newPassword, setNewPassword] = useState('');

    // 背景スクロールロック
    useEffect(() => {
        if (createdCredentials || resettingUser) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [createdCredentials, resettingUser]);

    useEffect(() => {
        fetchUsers();
        fetchLicenseInfo();
    }, []);

    const fetchUsers = async () => {
        try {
            const { data } = await api.get('/api/users');
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchLicenseInfo = async () => {
        try {
            const { data } = await api.get('/api/subscription');
            if (data?.subscription?.max_users) {
                setMaxUsers(data.subscription.max_users);
            } else {
                // Determine max users from tenant plan if subscription data is missing
                const { data: tenant } = await api.get('/api/settings/company');
                if (tenant?.plan === 'plus') setMaxUsers(10);
                else if (tenant?.plan === 'pro') setMaxUsers(50);
                else if (tenant?.plan === 'lite') setMaxUsers(2);
                else setMaxUsers(1);
            }
        } catch (err) {
            console.error('Failed to fetch license info:', err);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        const activeCount = users.filter(u => u.is_active).length;
        if (activeCount >= maxUsers) {
            await showAlert(`ライセンス上限に達しています (${activeCount}/${maxUsers})。招待する前に他のユーザーを無効化してください。`, 'error');
            return;
        }

        setInviting(true);
        try {
            const { data } = await api.post('/api/users/invite', { employeeId: inviteEmployeeId, name: inviteName, role: inviteRole });
            setCreatedCredentials({
                employeeId: inviteEmployeeId,
                name: inviteName,
                tempPassword: data.tempPassword
            });
            setShowPassword(false);
            setInviteEmployeeId('');
            setInviteName('');
            await fetchUsers();
        } catch (err) {
            console.error('Invite failed:', err);
            await showAlert(err.response?.data?.message || '招待に失敗しました', 'error');
        } finally {
            setInviting(false);
        }
    };

    const toggleStatus = async (user) => {
        const newStatus = !user.is_active;
        if (newStatus) {
            const activeCount = users.filter(u => u.is_active).length;
            if (activeCount >= maxUsers) {
                await showAlert(`ライセンス上限に達しているため、有効化できません (${activeCount}/${maxUsers})`, 'error');
                return;
            }
        }

        try {
            await api.put(`/api/users/${user.id}`, { isActive: newStatus });
            setUsers(users.map(u => u.id === user.id ? { ...u, is_active: newStatus } : u));
        } catch (err) {
            await showAlert(err.response?.data?.error || 'ステータスの更新に失敗しました', 'error');
        }
    };

    const handleRoleChange = async (targetUser, newRole) => {
        if (targetUser.role === newRole) return;

        const roleLabels = {
            'system_admin': 'システム管理者',
            'admin': '管理者',
            'user': '一般ユーザー'
        };

        const roleLevels = {
            'system_admin': 3,
            'admin': 2,
            'user': 1
        };

        const isDowngrade = roleLevels[targetUser.role] > roleLevels[newRole];
        let message = `${targetUser.name} の権限を「${roleLabels[newRole]}」に変更しますか？`;

        if (isDowngrade) {
            message += `\n\n【注意】権限を降格させると、一部の管理機能が利用できなくなります。`;
        }

        if (!await showConfirm(message)) return;

        try {
            await api.put(`/api/users/${targetUser.id}`, { role: newRole });
            setUsers(users.map(u => u.id === targetUser.id ? { ...u, role: newRole } : u));

            // 自分自身の権限を変更した場合は、プロファイルを再取得して反映（リログ相当の効果）
            if (targetUser.id === user?.id) {
                await showAlert('自身の権限を変更しました。最新の権限を適用するために情報を更新します。', 'info');
                // ページリロード、あるいは AuthContext の fetchProfile を呼ぶ
                window.location.reload();
            } else {
                await showAlert('権限を更新しました。', 'success');
            }
        } catch (err) {
            await showAlert(err.response?.data?.error || err.response?.data?.message || '権限の更新に失敗しました', 'error');
        }
    };

    const openResetPasswordModal = (user) => {
        setResettingUser(user);
        setNewPassword('');
    };

    const submitResetPassword = async (e) => {
        e.preventDefault();
        if (newPassword.length < 8) {
            await showAlert('パスワードは8文字以上で入力してください', 'error');
            return;
        }

        if (!await showConfirm(`${resettingUser.name} のパスワードを上書きしますか？`)) return;
        try {
            await api.post(`/api/users/${resettingUser.id}/reset-password`, { newPassword });
            await showAlert('パスワードの再設定が完了しました。ユーザーに新しいパスワードをお伝えください。', 'success');
            setResettingUser(null);
            setNewPassword('');
        } catch (err) {
            await showAlert(err.response?.data?.message || 'パスワードの再設定に失敗しました', 'error');
        }
    };

    const handleDelete = async (user) => {
        if (!await showConfirm(`${user.name} を完全に削除しますか？\nこの操作は取り消せません。`)) return;
        try {
            await api.delete(`/api/users/${user.id}`);
            setUsers(users.filter(u => u.id !== user.id));
        } catch (err) {
            await showAlert(err.response?.data?.message || err.response?.data?.error || 'ユーザーの削除に失敗しました', 'error');
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
    );

    const activeUsersCount = users.filter(u => u.is_active).length;

    return (
        <div className="space-y-6">
            {/* ログイン案内 */}
            <div className="bg-blue-500/10 border border-blue-500/30 p-5 rounded-xl">
                <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-blue-500/20 rounded-lg shrink-0 mt-0.5">
                        <Building2 className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                            会社コード: <span className="px-3 py-1 bg-slate-900 rounded-md text-blue-300 font-mono select-all tracking-wider">{tenant?.slug || '...'}</span>
                        </h4>
                        <div className="bg-slate-900/50 rounded-lg p-3 mt-3 border border-slate-700/50">
                            <p className="text-sm text-slate-300 flex items-start gap-2 leading-relaxed">
                                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                                <span>
                                    <strong>従業員への案内方法:</strong><br />
                                    従業員がログインする際は、上記の「<span className="text-blue-300">会社コード</span>」と、ここで設定した「<span className="text-emerald-400">従業員番号</span>」「<span className="text-amber-400">パスワード</span>」の3点が必要になります。新規ユーザーを追加した後は、これら3つの情報を対象の従業員にお伝えください。
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ライセンス情報 */}
            <div className="bg-indigo-600/10 border border-indigo-500/20 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                        <Users size={20} className="text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">現在のライセンス使用状況</p>
                        <h4 className="text-lg font-black text-white">利用中: {activeUsersCount} / {maxUsers} 名</h4>
                    </div>
                </div>
                <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${activeUsersCount >= maxUsers ? 'bg-amber-500' : 'bg-indigo-500'}`}
                        style={{ width: `${Math.min(100, (activeUsersCount / maxUsers) * 100)}%` }}
                    />
                </div>
            </div>

            {/* 権限ガイド */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800/40 border border-slate-700 p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                        <Shield size={16} className="text-amber-400" />
                        <span className="text-sm font-bold text-amber-400">システム管理者</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        全機能の操作が可能です。<br />
                        ユーザー管理、支払い、アプリ全般の設定変更が行えます。
                    </p>
                </div>
                <div className="bg-slate-800/40 border border-slate-700 p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                        <Shield size={16} className="text-purple-400" />
                        <span className="text-sm font-bold text-purple-400">管理者</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        アプリの設定変更が可能です。<br />
                        ユーザー管理や支払い情報の閲覧・操作は制限されます。
                    </p>
                </div>
                <div className="bg-slate-800/40 border border-slate-700 p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center">
                            <Users size={10} className="text-slate-400" />
                        </div>
                        <span className="text-sm font-bold text-slate-300">一般ユーザー</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        通常業務の操作が可能です。<br />
                        管理画面（この画面）へのアクセスはできません。
                    </p>
                </div>
            </div>

            {/* 招待フォーム */}
            {isSystemAdmin && (
                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                        <UserPlus size={20} className="text-indigo-400" />
                        ユーザーを招待
                    </h3>
                    <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs text-slate-400 mb-1">名前</label>
                            <input
                                type="text" required value={inviteName} onChange={e => setInviteName(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none"
                                placeholder="担当者氏名"
                            />
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs text-slate-400 mb-1">従業員番号 (ログインID)</label>
                            <input
                                type="text" required value={inviteEmployeeId} onChange={e => setInviteEmployeeId(e.target.value)}
                                pattern="[a-zA-Z0-9_\-]+"
                                title="半角英数字、ハイフン、アンダースコアのみ使用可能"
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none"
                                placeholder="001, emp123 等"
                            />
                        </div>
                        <div className="w-32">
                            <label className="block text-xs text-slate-400 mb-1">権限</label>
                            <select
                                value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none"
                            >
                                <option value="user">一般</option>
                                <option value="admin">管理者</option>
                                <option value="system_admin">システム管理者</option>
                            </select>
                        </div>
                        <button
                            type="submit" disabled={inviting}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg text-sm font-bold disabled:opacity-50 transition-colors"
                        >
                            {inviting ? '招待中...' : '招待送信'}
                        </button>
                    </form>
                </div>
            )}

            {/* ユーザー一覧 */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700 bg-slate-800/80">
                    <h3 className="font-bold text-slate-200 flex items-center gap-2">
                        <Users size={20} className="text-emerald-400" />
                        登録ユーザー一覧 ({users.length}名)
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-400 bg-slate-900/50 border-b border-slate-700">
                            <tr>
                                <th className="px-4 py-3">名前</th>
                                <th className="px-4 py-3">ログインID / メールアドレス</th>
                                <th className="px-4 py-3">権限</th>
                                <th className="px-4 py-3">ステータス</th>
                                <th className="px-4 py-3 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {users.map(user => (
                                <tr key={user.id} className={`hover:bg-slate-800/30 transition-colors ${!user.is_active ? 'opacity-50' : ''}`}>
                                    <td className="px-4 py-3 font-medium text-slate-200">{user.name}</td>
                                    <td className="px-4 py-3 text-slate-400">{user.employee_id || user.email}</td>
                                    <td className="px-4 py-3">
                                        {user.role === 'system_admin' ? (
                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-900/40 px-2 py-0.5 rounded border border-amber-800/50">
                                                <Shield size={12} /> システム管理者
                                            </span>
                                        ) : user.role === 'admin' ? (
                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-400 bg-purple-900/40 px-2 py-0.5 rounded border border-purple-800/50">
                                                <Shield size={12} /> 管理者
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                                                一般ユーザー
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {user.is_active ? (
                                            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                                                <CheckCircle size={14} /> 有効
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold">
                                                <XCircle size={14} /> 無効
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {isSystemAdmin ? (
                                            <div className="flex items-center justify-end gap-3">
                                                <button
                                                    onClick={() => openResetPasswordModal(user)}
                                                    className="text-xs font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1"
                                                    title="パスワードを任意に再設定"
                                                >
                                                    <Key size={12} />
                                                    PW設定
                                                </button>
                                                <select
                                                    value={user.role}
                                                    onChange={(e) => handleRoleChange(user, e.target.value)}
                                                    className="text-xs font-medium text-indigo-300 bg-slate-800 border border-slate-600 rounded px-1 py-1 cursor-pointer outline-none"
                                                >
                                                    <option value="user">一般</option>
                                                    <option value="admin">管理者</option>
                                                    <option value="system_admin">システム管理者</option>
                                                </select>
                                                <button
                                                    onClick={() => toggleStatus(user)}
                                                    className={`text-xs font-bold px-2 py-1 rounded transition-colors ${user.is_active
                                                        ? 'text-rose-400 hover:bg-rose-500/10'
                                                        : 'text-emerald-400 hover:bg-emerald-500/10'}`}
                                                >
                                                    {user.is_active ? '無効にする' : '有効にする'}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(user)}
                                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                    title="ユーザーを完全に削除"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-500">権限なし</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-4 py-8 text-center text-slate-400">
                                        ユーザーが見つかりません
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Temp Password Modal */}
            {createdCredentials && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setCreatedCredentials(null)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-900/30 rounded-xl">
                                    <Key size={22} className="text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white">{createdCredentials.isReset ? 'パスワード再設定完了' : 'ユーザー作成完了'}</h3>
                                    <p className="text-sm text-slate-400">{createdCredentials.isReset ? '新しいパスワードを控えてください' : '仮パスワードを控えてください'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-4 text-amber-300 text-sm">
                                <strong>⚠ 重要:</strong> {createdCredentials.isReset ? 'この新しいパスワードは今回のみ表示されます。必ず記録してからこの画面を閉じてください。' : 'このパスワードは今回のみ表示されます。必ず記録してからこの画面を閉じてください。'}
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ユーザー名</label>
                                    <div className="text-sm text-white font-medium mt-0.5">{createdCredentials.name}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">メールアドレス</label>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-sm text-white font-medium">{createdCredentials.email}</span>
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(createdCredentials.email); }}
                                            className="p-1 hover:bg-slate-800 rounded-lg transition-colors"
                                            title="コピー"
                                        >
                                            <Copy size={14} className="text-slate-500" />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{createdCredentials.isReset ? '新しいパスワード' : '仮パスワード'}</label>
                                    <div className="flex items-center gap-2 mt-0.5 bg-slate-800 p-3 rounded-xl border border-slate-700">
                                        <code className="text-sm font-mono text-emerald-400 flex-1 tracking-wider">
                                            {showPassword ? createdCredentials.tempPassword : '••••••••••••'}
                                        </code>
                                        <button
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                                            title={showPassword ? '隠す' : '表示'}
                                        >
                                            {showPassword ? <EyeOff size={16} className="text-slate-500" /> : <Eye size={16} className="text-slate-500" />}
                                        </button>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(createdCredentials.tempPassword);
                                                showAlert('パスワードをコピーしました', 'success');
                                            }}
                                            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                                            title="コピー"
                                        >
                                            <Copy size={16} className="text-blue-400" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-800 flex justify-end">
                            <button
                                onClick={() => setCreatedCredentials(null)}
                                className="px-6 py-2.5 bg-slate-700 text-white rounded-xl font-bold text-sm hover:bg-slate-600 transition-all"
                            >
                                確認しました
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Password Reset Modal */}
            {resettingUser && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => { setResettingUser(null); setNewPassword(''); }}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                            <div className="p-2 bg-amber-900/30 rounded-xl">
                                <Key size={22} className="text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white">パスワードの再設定</h3>
                                <p className="text-sm text-slate-400">{resettingUser.name} のパスワード</p>
                            </div>
                        </div>
                        <form onSubmit={submitResetPassword} className="p-6 space-y-4">
                            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-slate-300 text-sm">
                                ユーザーに対して設定したい任意のパスワードを8文字以上で入力してください。現在のパスワードは無効になります。
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1 tracking-wider uppercase">新しいパスワード</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        minLength={8}
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-3 pr-10 py-2.5 text-slate-200 focus:ring-1 focus:ring-amber-500 outline-none placeholder:text-xs sm:placeholder:text-sm"
                                        placeholder="8文字以上の英数字"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-3 justify-end mt-6">
                                <button
                                    type="button"
                                    onClick={() => { setResettingUser(null); setNewPassword(''); }}
                                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-sm transition-colors"
                                >
                                    キャンセル
                                </button>
                                <button
                                    type="submit"
                                    disabled={newPassword.length < 8}
                                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-colors"
                                >
                                    パスワードを変更
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div >
    );
}
