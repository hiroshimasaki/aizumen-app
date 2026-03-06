import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, ThumbsUp, Plus, Search, Filter, CheckCircle2, HelpCircle, Lightbulb, BookOpen, MoreHorizontal, Send, Edit2, Trash2, ArrowLeft, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import api from '../lib/api';

const CATEGORIES = [
    { value: 'all', label: 'すべて', icon: Filter, color: 'slate' },
    { value: 'question', label: '質問', icon: HelpCircle, color: 'blue' },
    { value: 'suggestion', label: '改善提案', icon: Lightbulb, color: 'amber' },
    { value: 'tips', label: 'ノウハウ', icon: BookOpen, color: 'emerald' },
    { value: 'other', label: 'その他', icon: MoreHorizontal, color: 'slate' },
];

const maskText = (text) => {
    if (!text) return '';
    if (text.length <= 1) return '*';
    if (text.length === 2) return text[0] + '*';
    return text[0] + '*'.repeat(text.length - 2) + text[text.length - 1];
};

const CATEGORY_STYLES = {
    question: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', label: '質問' },
    suggestion: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', label: '改善提案' },
    tips: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', label: 'ノウハウ' },
    other: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20', label: 'その他' },
};

export default function ForumPage() {
    const { user } = useAuth();
    const { showAlert, showConfirm } = useNotification();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedPost, setSelectedPost] = useState(null);
    const [showNewPostForm, setShowNewPostForm] = useState(false);

    const fetchPosts = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, sortBy: 'created_at', sortDir: 'desc' });
            if (category !== 'all') params.set('category', category);
            if (search) params.set('search', search);
            const { data } = await api.get(`/api/forum?${params}`);
            setPosts(data.data);
            setTotalPages(data.totalPages);
        } catch (err) {
            console.error('Failed to fetch posts:', err);
        } finally {
            setLoading(false);
        }
    }, [page, category, search]);

    useEffect(() => { fetchPosts(); }, [fetchPosts]);

    const handlePostCreated = () => {
        setShowNewPostForm(false);
        setPage(1);
        fetchPosts();
    };

    const handlePostSelected = async (postId) => {
        try {
            const { data } = await api.get(`/api/forum/${postId}`);
            setSelectedPost(data);
        } catch (err) {
            console.error('Failed to fetch post detail:', err);
        }
    };

    const handleLikePost = async (postId) => {
        try {
            const { data } = await api.post(`/api/forum/${postId}/like`);
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, like_count: data.like_count, liked_by_me: data.liked } : p));
            if (selectedPost?.id === postId) {
                setSelectedPost(prev => ({ ...prev, like_count: data.like_count, liked_by_me: data.liked }));
            }
        } catch (err) { console.error(err); }
    };

    const handleDeletePost = async (postId) => {
        if (!await showConfirm('この投稿を削除しますか?')) return;
        try {
            await api.delete(`/api/forum/${postId}`);
            setSelectedPost(null);
            fetchPosts();
        } catch (err) { console.error(err); }
    };

    const handleResolve = async (postId) => {
        try {
            const { data } = await api.patch(`/api/forum/${postId}/resolve`);
            if (selectedPost?.id === postId) setSelectedPost(prev => ({ ...prev, is_resolved: data.is_resolved }));
            fetchPosts();
        } catch (err) { console.error(err); }
    };

    // 詳細ビュー
    if (selectedPost) {
        return (
            <PostDetail
                post={selectedPost}
                currentUserId={user?.id}
                onBack={() => { setSelectedPost(null); fetchPosts(); }}
                onLike={() => handleLikePost(selectedPost.id)}
                onDelete={() => handleDeletePost(selectedPost.id)}
                onResolve={() => handleResolve(selectedPost.id)}
                onRefresh={() => handlePostSelected(selectedPost.id)}
                showAlert={showAlert}
                showConfirm={showConfirm}
            />
        );
    }

    return (
        <div className="space-y-6">
            {/* ヘッダー */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white">コミュニティフォーラム</h1>
                    <p className="text-sm text-slate-400 mt-1">ユーザー同士で質問・改善提案・ノウハウを共有できます</p>
                </div>
                <button
                    onClick={() => setShowNewPostForm(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-xl hover:from-blue-500 hover:to-cyan-500 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                    <Plus className="w-4 h-4" /> 新規投稿
                </button>
            </div>

            {/* フィルタ・検索 */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex gap-1 overflow-x-auto pb-1">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.value}
                            onClick={() => { setCategory(cat.value); setPage(1); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                                category === cat.value ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                            }`}
                        >
                            <cat.icon className="w-3.5 h-3.5" /> {cat.label}
                        </button>
                    ))}
                </div>
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="キーワード検索..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full bg-slate-800/50 border border-white/5 rounded-xl py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
                    />
                </div>
            </div>

            {/* 新規投稿フォーム */}
            {showNewPostForm && (
                <NewPostForm onClose={() => setShowNewPostForm(false)} onCreated={handlePostCreated} showAlert={showAlert} />
            )}

            {/* 投稿一覧 */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin" />
                </div>
            ) : posts.length === 0 ? (
                <div className="text-center py-20">
                    <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium">投稿はまだありません</p>
                    <p className="text-slate-500 text-sm mt-1">最初の投稿を作成してみましょう</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {posts.map(post => (
                        <PostCard key={post.id} post={post} onClick={() => handlePostSelected(post.id)} onLike={() => handleLikePost(post.id)} />
                    ))}
                </div>
            )}

            {/* ページネーション */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm text-slate-400 font-medium">{page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>
    );
}

/** 投稿カード */
function PostCard({ post, onClick, onLike }) {
    const cat = CATEGORY_STYLES[post.category] || CATEGORY_STYLES.other;
    return (
        <div
            className="bg-slate-800/30 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all cursor-pointer group"
            onClick={onClick}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${cat.bg} ${cat.text} border ${cat.border}`}>{cat.label}</span>
                        {post.is_resolved && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">解決済み</span>
                        )}
                    </div>
                    <h3 className="text-white font-bold group-hover:text-blue-300 transition-colors truncate">{post.title}</h3>
                    <p className="text-slate-500 text-xs mt-1.5 line-clamp-2">{post.body}</p>
                </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="font-medium text-slate-300">{maskText(post.user_name)}</span>
                    {post.tenant_name && <span className="text-slate-600">@{maskText(post.tenant_name)}</span>}
                    <span>{new Date(post.created_at).toLocaleDateString('ja-JP')}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                    <button
                        onClick={e => { e.stopPropagation(); onLike(); }}
                        className={`flex items-center gap-1 transition-colors ${post.liked_by_me ? 'text-pink-400' : 'hover:text-pink-400'}`}
                    >
                        <ThumbsUp className="w-3.5 h-3.5" /> {post.like_count || 0}
                    </button>
                    <span className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" /> {post.reply_count || 0}
                    </span>
                </div>
            </div>
        </div>
    );
}

/** 新規投稿フォーム */
function NewPostForm({ onClose, onCreated, showAlert }) {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [category, setCategory] = useState('question');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/forum', { title, body, category });
            onCreated();
        } catch (err) {
            await showAlert('投稿に失敗しました', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">新規投稿</h2>
                <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-2">
                    {CATEGORIES.filter(c => c.value !== 'all').map(cat => (
                        <button
                            key={cat.value}
                            type="button"
                            onClick={() => setCategory(cat.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                category === cat.value ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-slate-400 hover:text-white bg-white/5 border border-transparent'
                            }`}
                        >{cat.label}</button>
                    ))}
                </div>
                <input
                    type="text" required placeholder="タイトル"
                    value={title} onChange={e => setTitle(e.target.value)}
                    className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
                />
                <textarea
                    required placeholder="内容を入力してください..."
                    rows={5} value={body} onChange={e => setBody(e.target.value)}
                    className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                />
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 font-medium rounded-xl hover:bg-white/5 transition-all">キャンセル</button>
                    <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 disabled:opacity-50 transition-all">
                        {loading ? '投稿中...' : '投稿する'}
                    </button>
                </div>
            </form>
        </div>
    );
}

/** 投稿詳細 + 返信 */
function PostDetail({ post, currentUserId, onBack, onLike, onDelete, onResolve, onRefresh, showAlert, showConfirm }) {
    const [replyBody, setReplyBody] = useState('');
    const [sending, setSending] = useState(false);
    const [editingReplyId, setEditingReplyId] = useState(null);
    const [editReplyBody, setEditReplyBody] = useState('');
    
    // 投稿の編集状態
    const [isEditingPost, setIsEditingPost] = useState(false);
    const [editPostTitle, setEditPostTitle] = useState('');
    const [editPostBody, setEditPostBody] = useState('');
    const [editPostCategory, setEditPostCategory] = useState('');
    const [isUpdatingPost, setIsUpdatingPost] = useState(false);

    const cat = CATEGORY_STYLES[post.category] || CATEGORY_STYLES.other;
    const isAuthor = post.user_id === currentUserId;

    const startEditingPost = () => {
        setEditPostTitle(post.title);
        setEditPostBody(post.body);
        setEditPostCategory(post.category);
        setIsEditingPost(true);
    };

    const handleEditPost = async () => {
        setIsUpdatingPost(true);
        try {
            await api.put(`/api/forum/${post.id}`, {
                title: editPostTitle,
                body: editPostBody,
                category: editPostCategory
            });
            setIsEditingPost(false);
            onRefresh();
            await showAlert('投稿を更新しました', 'success');
        } catch (err) {
            console.error(err);
            await showAlert('投稿の更新に失敗しました', 'error');
        } finally {
            setIsUpdatingPost(false);
        }
    };

    const handleReply = async (e) => {
        e.preventDefault();
        if (!replyBody.trim()) return;
        setSending(true);
        try {
            await api.post(`/api/forum/${post.id}/replies`, { body: replyBody });
            setReplyBody('');
            onRefresh();
            await showAlert('返信を投稿しました', 'success');
        } catch (err) { 
            console.error(err);
            await showAlert(err.response?.data?.message || err.response?.data?.error || err.message || '返信の投稿に失敗しました', 'error');
        }
        finally { setSending(false); }
    };

    const handleLikeReply = async (replyId) => {
        try {
            await api.post(`/api/forum/replies/${replyId}/like`);
            onRefresh();
        } catch (err) { console.error(err); }
    };

    const handleDeleteReply = async (replyId) => {
        if (!await showConfirm('この返信を削除しますか?')) return;
        try {
            await api.delete(`/api/forum/replies/${replyId}`);
            onRefresh();
        } catch (err) { console.error(err); }
    };

    const handleEditReply = async (replyId) => {
        try {
            await api.put(`/api/forum/replies/${replyId}`, { body: editReplyBody });
            setEditingReplyId(null);
            onRefresh();
        } catch (err) { console.error(err); }
    };

    return (
        <div className="space-y-6">
            <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm font-medium transition-colors">
                <ArrowLeft className="w-4 h-4" /> 一覧に戻る
            </button>

            {/* 投稿本文 */}
            {isEditingPost ? (
                <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white">投稿を編集</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            {CATEGORIES.filter(c => c.value !== 'all').map(categoryOption => (
                                <button
                                    key={categoryOption.value}
                                    type="button"
                                    onClick={() => setEditPostCategory(categoryOption.value)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        editPostCategory === categoryOption.value ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-slate-400 hover:text-white bg-white/5 border border-transparent'
                                    }`}
                                >{categoryOption.label}</button>
                            ))}
                        </div>
                        <input
                            type="text" required placeholder="タイトル"
                            value={editPostTitle} onChange={e => setEditPostTitle(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
                        />
                        <textarea
                            required placeholder="内容を入力してください..."
                            rows={8} value={editPostBody} onChange={e => setEditPostBody(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                        />
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setIsEditingPost(false)} className="px-4 py-2 text-slate-400 font-medium rounded-xl hover:bg-white/5 transition-all">キャンセル</button>
                            <button onClick={handleEditPost} disabled={isUpdatingPost || !editPostTitle.trim() || !editPostBody.trim()} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 disabled:opacity-50 transition-all">
                                {isUpdatingPost ? '保存中...' : '保存'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-800/30 border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${cat.bg} ${cat.text} border ${cat.border}`}>{cat.label}</span>
                        {post.is_resolved && <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">解決済み</span>}
                    </div>
                    <h2 className="text-xl font-black text-white mb-2">{post.title}</h2>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                        <span className="font-medium text-slate-300">{maskText(post.user_name)}</span>
                        {post.tenant_name && <span>@{maskText(post.tenant_name)}</span>}
                        <span>{new Date(post.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        {post.updated_at !== post.created_at && <span className="text-slate-600">(編集済み)</span>}
                    </div>
                    <p className="text-slate-300 whitespace-pre-wrap leading-relaxed text-sm">{post.body}</p>
    
                    <div className="flex items-center gap-3 mt-6 pt-4 border-t border-white/5">
                        <button onClick={onLike} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${post.liked_by_me ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' : 'text-slate-400 hover:text-pink-400 bg-white/5'}`}>
                            <ThumbsUp className="w-4 h-4" /> {post.like_count || 0}
                        </button>
                        {isAuthor && (
                            <button onClick={onResolve} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${post.is_resolved ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-emerald-400 bg-white/5'}`}>
                                <CheckCircle2 className="w-4 h-4" /> {post.is_resolved ? '解決済み' : '解決済みにする'}
                            </button>
                        )}
                        {isAuthor && (
                            <button onClick={startEditingPost} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-blue-400 bg-white/5 transition-all">
                                <Edit2 className="w-4 h-4" /> 編集
                            </button>
                        )}
                        {isAuthor && (
                            <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-red-400 bg-white/5 transition-all">
                                <Trash2 className="w-4 h-4" /> 削除
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* 返信一覧 */}
            <div>
                <h3 className="text-sm font-bold text-slate-300 mb-3">返信 ({post.replies?.length || 0})</h3>
                <div className="space-y-3">
                    {(post.replies || []).map(reply => (
                        <div key={reply.id} className="bg-slate-800/20 border border-white/5 rounded-xl p-4">
                            {editingReplyId === reply.id ? (
                                <div className="space-y-2">
                                    <textarea value={editReplyBody} onChange={e => setEditReplyBody(e.target.value)} rows={3}
                                        className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all resize-none" />
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={() => setEditingReplyId(null)} className="text-xs text-slate-400 px-3 py-1 rounded-lg hover:bg-white/5">キャンセル</button>
                                        <button onClick={() => handleEditReply(reply.id)} className="text-xs text-blue-400 font-bold px-3 py-1 rounded-lg bg-blue-500/10">保存</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                                        <span className="font-medium text-slate-300">{maskText(reply.user_name)}</span>
                                        {reply.tenant_name && <span>@{maskText(reply.tenant_name)}</span>}
                                        <span>{new Date(reply.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                        {reply.updated_at !== reply.created_at && <span className="text-slate-600">(編集済み)</span>}
                                    </div>
                                    <p className="text-slate-300 text-sm whitespace-pre-wrap">{reply.body}</p>
                                    <div className="flex items-center gap-2 mt-3">
                                        <button onClick={() => handleLikeReply(reply.id)} className={`flex items-center gap-1 text-xs transition-colors ${reply.liked_by_me ? 'text-pink-400' : 'text-slate-500 hover:text-pink-400'}`}>
                                            <ThumbsUp className="w-3 h-3" /> {reply.like_count || 0}
                                        </button>
                                        {reply.user_id === currentUserId && (
                                            <>
                                                <button onClick={() => { setEditingReplyId(reply.id); setEditReplyBody(reply.body); }} className="text-xs text-slate-500 hover:text-blue-400 transition-colors"><Edit2 className="w-3 h-3" /></button>
                                                <button onClick={() => handleDeleteReply(reply.id)} className="text-xs text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* 返信フォーム */}
            <form onSubmit={handleReply} className="flex gap-2">
                <input
                    type="text" required placeholder="返信を入力..."
                    value={replyBody} onChange={e => setReplyBody(e.target.value)}
                    className="flex-1 bg-slate-800/50 border border-white/5 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
                />
                <button type="submit" disabled={sending || !replyBody.trim()} className="px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:opacity-50 transition-all">
                    <Send className="w-4 h-4" />
                </button>
            </form>
        </div>
    );
}
