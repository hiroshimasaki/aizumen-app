import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, Brain, CalendarDays, FileText, ChevronRight, Shield, Upload, Cpu, CheckCircle, Check, ArrowRight, TrendingUp, Mail, Search, Users, MapPin, ShieldCheck, Lock } from 'lucide-react';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[#0B1120] text-slate-200 font-sans selection:bg-blue-500/30 overflow-x-hidden">
            {/* Background Effects */}
            <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-600/20 blur-[120px] pointer-events-none" />

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/50 backdrop-blur-md border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap className="w-6 h-6 text-cyan-400" />
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent tracking-tight">
                            AiZumen
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link
                            to="/login"
                            className="text-sm font-medium text-slate-300 hover:text-white transition-colors hidden sm:block"
                        >
                            ログイン
                        </Link>
                        <Link
                            to="/signup"
                            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white text-sm font-bold transition-all"
                        >
                            無料トライアル
                        </Link>
                    </div>
                </div>
            </header>

            <main className="relative z-10 pt-24 pb-16">
                {/* Hero Section */}
                <section className="max-w-7xl mx-auto px-4 md:px-8 pt-16 md:pt-32 pb-20 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-8 animate-[fade-in-up_0.8s_ease-out_forwards]">
                        <Sparkles className="w-4 h-4" />
                        <span>注文書AI解析・工程管理SaaS</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight tracking-tight opacity-0 animate-[fade-in-up_0.8s_ease-out_0.1s_forwards]">
                        注文書の入力と図面管理を、<br />
                        <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">AIとクラウドで一元化。</span>
                    </h1>
                    <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 mb-10 opacity-0 animate-[fade-in-up_0.8s_ease-out_0.2s_forwards]">
                        製造業の受発注業務を革新するクラウドサービス。AIが注文書からテキスト情報を自動抽出して入力の手間を大幅削減。図面データも紐付けて管理できるため、現場でのペーパーレス化を実現します。
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0 animate-[fade-in-up_0.8s_ease-out_0.3s_forwards]">
                        <Link
                            to="/signup"
                            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-lg hover:from-blue-500 hover:to-cyan-500 transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 group"
                        >
                            無料で始める
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link
                            to="/login"
                            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-lg transition-all flex items-center justify-center gap-2 sm:hidden"
                        >
                            ログイン
                        </Link>
                    </div>
                </section>

                {/* Hero Dashboard Mockup */}
                <div className="max-w-6xl mx-auto px-4 mt-12 mb-20 opacity-0 animate-[fade-in-up_1s_ease-out_0.5s_forwards]">
                    <div className="relative group">
                        {/* Decorative background glow */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-[2.5rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>

                        <div className="relative rounded-[2rem] overflow-hidden border border-white/10 bg-slate-900 shadow-2xl">
                            {/* Real Screenshot with its own header */}
                            <img
                                src="/assets/lp/hero-dashboard.png"
                                alt="AiZumen 案件一覧画面"
                                className="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-[1.01]"
                            />

                            {/* Floating Stats or Overlay */}
                            <div className="absolute bottom-6 right-6 p-4 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl transform translate-y-2 group-hover:translate-y-0 transition-transform hidden md:block">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">実績同期完了</p>
                                        <p className="text-sm font-bold text-white leading-tight">リアルタイムに数値を更新</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Note */}
                        <p className="mt-4 text-center text-xs text-slate-400/80 italic">※画面はテストデータを用いた開発中のものです。</p>
                    </div>
                </div>

                {/* Pain Points Section */}
                <section className="max-w-7xl mx-auto px-4 md:px-8 py-24 relative overflow-hidden">
                    <div className="absolute top-1/2 left-0 -translate-y-1/2 w-64 h-64 bg-blue-500/5 blur-[100px] pointer-events-none"></div>
                    <div className="text-center mb-16 relative z-10">
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-6">こんなお困りごとないですか？</h2>
                        <p className="text-lg text-slate-400 max-w-2xl mx-auto">製造現場の「当たり前」になってしまっている非効率。AiZumenが変えます。</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 relative z-10">
                        {/* Pain Point 1 */}
                        <div className="p-8 rounded-3xl bg-slate-800/30 border border-slate-700/50 hover:border-blue-500/30 transition-all group">
                            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Mail className="w-7 h-7 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-4">お客様からの注文は<br />FAXや郵便で届く</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                届いた書類を手動でシステムに入力する手間。忙しい時の入力漏れや、小さな数字の転記ミスへの不安が常にありませんか？
                            </p>
                        </div>

                        {/* Pain Point 2 */}
                        <div className="p-8 rounded-3xl bg-slate-800/30 border border-slate-700/50 hover:border-cyan-500/30 transition-all group">
                            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Search className="w-7 h-7 text-cyan-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-4">ファイルに綴じているが、<br />探すのに時間がかかる</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                「あの図面どこだっけ？」と過去の資料を棚から引っ張り出す時間。事務所内を走り回るムダな時間は、もう終わりにしましょう。
                            </p>
                        </div>

                        {/* Pain Point 3 */}
                        <div className="p-8 rounded-3xl bg-slate-800/30 border border-slate-700/50 hover:border-emerald-500/30 transition-all group">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Users className="w-7 h-7 text-emerald-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-4">進捗や図面が、<br />担当者に聞かないと不明</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                現場と事務所で情報が分断され、納期確認や工程の把握が電話や口頭頼みに。属人化した情報管理こそが、ミスの温床です。
                            </p>
                        </div>
                    </div>

                    <div className="mt-16 text-center">
                        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
                            <Zap className="w-5 h-5 text-blue-400" />
                            <p className="text-sm font-bold text-white">AiZumenなら、これらのお困りごとをまるごと解決できます。</p>
                        </div>
                    </div>
                </section>

                {/* Workflow Section */}
                <section className="max-w-7xl mx-auto px-4 md:px-8 py-20 bg-slate-900/40 border-y border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent"></div>
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold mb-4">
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                            SIMPLE WORKFLOW
                        </div>
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-6">利用の流れ</h2>
                        <p className="text-lg text-slate-400 md:max-w-2xl mx-auto">わずか3ステップ。注文書の処理から現場の図面確認・工程管理まで、すべての業務がブラウザ上で完結します。</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 relative mt-12">
                        <div className="hidden md:block absolute top-[45px] left-[15%] right-[15%] h-0.5 bg-slate-800 z-0 border-b border-dashed border-slate-700"></div>
                        {/* Step 1 */}
                        <div className="relative z-10 flex flex-col justify-start text-center p-6">
                            <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-800 border-2 border-blue-500/30 flex items-center justify-center mb-8 shadow-xl shadow-blue-500/10 rotate-3 hover:rotate-0 transition-transform">
                                <Upload className="w-8 h-8 text-blue-400" />
                            </div>
                            <div className="text-blue-400 font-black text-sm uppercase tracking-widest mb-3">Step 1</div>
                            <h3 className="text-2xl font-bold text-white mb-4">注文書をアップロード</h3>
                            <p className="text-slate-400 leading-relaxed text-sm">
                                PDF形式の注文書と関連する図面データをドラッグ＆ドロップ。複数ファイルの一括登録にも対応しています。
                            </p>
                        </div>
                        {/* Step 2 */}
                        <div className="relative z-10 flex flex-col justify-start text-center p-6">
                            <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-800 border-2 border-cyan-500/30 flex items-center justify-center mb-8 shadow-xl shadow-cyan-500/10 -rotate-3 hover:rotate-0 transition-transform">
                                <Cpu className="w-8 h-8 text-cyan-400" />
                            </div>
                            <div className="text-cyan-400 font-black text-sm uppercase tracking-widest mb-3">Step 2</div>
                            <h3 className="text-2xl font-bold text-white mb-4">AIが注文書を解析</h3>
                            <p className="text-slate-400 leading-relaxed text-sm">
                                AIが注文書を読み取り、品名・材質・数量・寸法などの情報を瞬時にデータ化し、図面と一緒にシステムへ登録されます。
                            </p>
                        </div>
                        {/* Step 3 */}
                        <div className="relative z-10 flex flex-col justify-start text-center p-6">
                            <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-800 border-2 border-emerald-500/30 flex items-center justify-center mb-8 shadow-xl shadow-emerald-500/10 rotate-3 hover:rotate-0 transition-transform">
                                <CalendarDays className="w-8 h-8 text-emerald-400" />
                            </div>
                            <div className="text-emerald-400 font-black text-sm uppercase tracking-widest mb-3">Step 3</div>
                            <h3 className="text-2xl font-bold text-white mb-4">ペーパーレス工程管理</h3>
                            <p className="text-slate-400 leading-relaxed text-sm">
                                案件はガントチャートで進捗管理。現場から直接ブラウザで紐づいた図面を拡大確認できるため、紙図面を探す手間が省かれます。
                            </p>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section className="max-w-7xl mx-auto px-4 md:px-8 py-24">
                    <div className="text-center mb-20">
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-6">AiZumenの3つの強み</h2>
                        <p className="text-lg text-slate-400 max-w-2xl mx-auto">紙中心の受発注業務をクラウド化し、圧倒的な精度とスピード、そして現場の情報共有を実現します。</p>
                    </div>

                    <div className="space-y-32">
                        {/* Feature 1: AI Analysis */}
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div className="order-2 md:order-1">
                                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
                                    <Brain className="w-6 h-6 text-blue-400" />
                                </div>
                                <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">複雑な注文書もAIが一括解析</h3>
                                <p className="text-slate-400 leading-relaxed mb-8">
                                    複数のPDF注文書をシステムへ一括投入。AIが品名、材質、数量、納期などの重要項目を最短数秒でデータ化します。手作業による入力ミスの不安から解放され、営業担当者はより付加価値の高い業務へ集中できます。
                                </p>
                                <ul className="space-y-3">
                                    {['多種多様なフォーマットに対応', '材質・寸法・単価を精度高く抽出', '一括アップロードで待ち時間をゼロに'].map((item, i) => (
                                        <li key={i} className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                            <Check className="w-5 h-5 text-blue-500" /> {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="order-1 md:order-2 relative group">
                                <div className="absolute -inset-4 bg-blue-500/10 rounded-[2.5rem] blur-2xl group-hover:bg-blue-500/20 transition-colors"></div>
                                <img
                                    src="/assets/lp/feature-ai-ocr.png"
                                    className="relative rounded-2xl border border-white/10 shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]"
                                    alt="AI解析機能"
                                />
                                <p className="mt-2 text-right text-xs text-slate-400/80 italic">※画面はテストデータを用いた開発中のものです。</p>
                            </div>
                        </div>

                        {/* Feature 2: Gantt / Sharing */}
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div className="relative group">
                                <div className="absolute -inset-4 bg-cyan-500/10 rounded-[2.5rem] blur-2xl group-hover:bg-cyan-500/20 transition-colors"></div>
                                <img
                                    src="/assets/lp/feature-gantt.png"
                                    className="relative rounded-2xl border border-white/10 shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]"
                                    alt="ガントチャート機能"
                                />
                                <p className="mt-2 text-left text-xs text-slate-400/80 italic">※画面はテストデータを用いた開発中のものです。</p>
                            </div>
                            <div>
                                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6">
                                    <CalendarDays className="w-6 h-6 text-cyan-400" />
                                </div>
                                <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">工程と図面が、いつでも現場で。</h3>
                                <p className="text-slate-400 leading-relaxed mb-8">
                                    案件登録と同時に、作業予定はガントチャートへ自動反映。現場のタブレットから直接図面を参照できるため、重たい図面ファイルを探し回る時間はもう必要ありません。情報共有のロスが、納期遅延を防ぐ最大の防御になります。
                                </p>
                                <ul className="space-y-3">
                                    {['クリック一つで関連図面を瞬時に表示', 'ガントチャートで全体の負荷を可視化', '現場での完了入力を事務所へ即時共有'].map((item, i) => (
                                        <li key={i} className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                            <Check className="w-5 h-5 text-cyan-500" /> {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Feature 3: Analysis */}
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div className="order-2 md:order-1">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6">
                                    <TrendingUp className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div className="flex items-center gap-3 mb-4">
                                    <h3 className="text-2xl md:text-3xl font-bold text-white">蓄積されたデータが経営を導く</h3>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-widest">Proプラン専用</span>
                                </div>
                                <p className="text-slate-400 leading-relaxed mb-8">
                                    過去の受注データと実績工数をリアルタイムに集計。顧客ごとの収益性や案件の不採算理由を可視化し、次なる見積の精度向上や価格交渉の確かな根拠を提供します。「経験と勘」を「データに基づいた経営」へ。
                                </p>
                                <ul className="space-y-3">
                                    {['顧客別の収益性ランキング表示', '月別・案件別の原価構成を自動分析', '受注率の推移をダッシュボードで把握'].map((item, i) => (
                                        <li key={i} className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                            <Check className="w-5 h-5 text-emerald-500" /> {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="order-1 md:order-2 relative group">
                                <div className="absolute -inset-4 bg-emerald-500/10 rounded-[2.5rem] blur-2xl group-hover:bg-emerald-500/20 transition-colors"></div>
                                <img
                                    src="/assets/lp/feature-analysis.png"
                                    className="relative rounded-2xl border border-white/10 shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]"
                                    alt="データ分析機能"
                                />
                                <p className="mt-2 text-right text-xs text-slate-400/80 italic">※画面はテストデータを用いた開発中のものです。</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Security Section (Updated for real specs) */}
                <section className="max-w-7xl mx-auto px-4 md:px-8 py-24 border-t border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] pointer-events-none"></div>
                    <div className="text-center mb-16 relative z-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold mb-4">
                            <Shield className="w-4 h-4 text-indigo-400" />
                            SECURITY & PRIVACY
                        </div>
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-6">機密情報を守る、万全のデータ保護体制</h2>
                        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                            製造業の重要資産である図面や注文データを、最新のクラウド技術と厳格な運用ポリシーで保護します。
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 relative z-10">
                        {/* Security Point 1 */}
                        <div className="p-8 rounded-3xl bg-slate-900/50 border border-white/5 hover:border-indigo-500/30 transition-all">
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-6">
                                <MapPin className="w-6 h-6 text-indigo-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-4">国内リージョンの採用</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                すべてのデータは、信頼性の高いクラウドプラットフォーム（Supabase / AWS）の**日本国内リージョン**で管理。法規制を遵守し、セキュアな環境を提供します。
                            </p>
                        </div>

                        {/* Security Point 2 */}
                        <div className="p-8 rounded-3xl bg-slate-900/50 border border-white/5 hover:border-blue-500/30 transition-all">
                            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-6">
                                <ShieldCheck className="w-6 h-6 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-4">AI学習へのデータ不使用</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                解析に使用するAI（Gemini API）は、**入力されたデータを学習に使用しない**エンタープライズ設定を採用。機密図面がAIに学習されることはありません。
                            </p>
                        </div>

                        {/* Security Point 3 */}
                        <div className="p-8 rounded-3xl bg-slate-900/50 border border-white/5 hover:border-cyan-500/30 transition-all">
                            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-6">
                                <Lock className="w-6 h-6 text-cyan-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-4">高度な暗号化通信</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                すべての通信はSSL/TLSによって高度に暗号化。保存された画像やPDFデータも厳重なアクセス制御下で保護され、許可されたユーザー以外は閲覧できません。
                            </p>
                        </div>
                    </div>
                </section>

                {/* Pricing Section */}
                <section className="max-w-7xl mx-auto px-4 md:px-8 pt-10 pb-24 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-blue-600/10 blur-[100px] pointer-events-none"></div>
                    <div className="text-center mb-16 relative z-10">
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-6">シンプルな料金プラン</h2>
                        <p className="text-lg text-slate-400">会社の規模と利用頻度に合わせて選べる3つのプランをご用意しました。<br className="hidden md:block" />まずは無料体験でお試しください。</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 relative z-10 items-center">
                        {/* Lite */}
                        <div className="p-8 rounded-3xl bg-slate-800/40 border border-slate-700/80 hover:border-slate-500 transition-all flex flex-col md:h-[450px]">
                            <div className="mb-6">
                                <h3 className="text-2xl font-bold text-white mb-1">Lite</h3>
                                <p className="text-sm text-slate-400 mb-6 h-5">少人数向け</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-white">¥10,000</span>
                                    <span className="text-sm text-slate-500">/ 月</span>
                                </div>
                            </div>
                            <div className="w-full h-px bg-slate-700/50 mb-6"></div>
                            <ul className="space-y-4 mb-8 flex-1">
                                <li className="flex items-start gap-3 text-sm text-slate-300 font-medium"><Check className="w-5 h-5 text-emerald-400 shrink-0" /> 最大2ユーザー利用可能</li>
                                <li className="flex items-start gap-3 text-sm text-slate-300 font-medium"><Check className="w-5 h-5 text-emerald-400 shrink-0" /> 毎月100 AIクレジット付与</li>
                                <li className="flex items-start gap-3 text-sm text-slate-300 font-medium"><Check className="w-5 h-5 text-emerald-400 shrink-0" /> ストレージ 5GB (約1万枚)</li>
                                <li className="flex items-start gap-3 text-sm text-slate-300 font-medium"><Check className="w-5 h-5 text-emerald-400 shrink-0" /> バックアップ 7日間保持</li>
                            </ul>
                            <Link to="/signup" className="w-full py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-center transition-all border border-white/5">無料で試す</Link>
                        </div>

                        {/* Plus */}
                        <div className="p-10 rounded-[2.5rem] bg-indigo-900/30 border border-indigo-500/50 shadow-2xl shadow-indigo-500/20 flex flex-col relative transform md:-translate-y-4 md:h-[500px] z-20 backdrop-blur-xl">
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg shadow-indigo-500/30">
                                圧倒的人気
                            </div>
                            <div className="mb-6">
                                <h3 className="text-2xl font-bold text-white mb-1">Plus</h3>
                                <p className="text-sm text-indigo-300 mb-6 h-5">標準的なチーム運用向け</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-5xl font-black text-white drop-shadow-md">¥30,000</span>
                                    <span className="text-sm text-indigo-300 font-medium">/ 月</span>
                                </div>
                            </div>
                            <div className="w-full h-px bg-indigo-500/30 mb-6"></div>
                            <ul className="space-y-4 mb-8 flex-1">
                                <li className="flex items-start gap-3 text-sm text-white font-medium"><Check className="w-5 h-5 text-cyan-400 shrink-0" /> 最大10ユーザー利用可能</li>
                                <li className="flex items-start gap-3 text-sm text-white font-medium"><Check className="w-5 h-5 text-cyan-400 shrink-0" /> 毎月500 AIクレジット付与</li>
                                <li className="flex items-start gap-3 text-sm text-white font-medium"><Check className="w-5 h-5 text-cyan-400 shrink-0" /> ストレージ 20GB (約4万枚)</li>
                                <li className="flex items-start gap-3 text-sm text-white font-medium"><Check className="w-5 h-5 text-cyan-400 shrink-0" /> バックアップ 7日間保持</li>
                            </ul>
                            <Link to="/signup" className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-center transition-all shadow-xl shadow-blue-500/30 text-lg">
                                7日間の無料体験を始める
                            </Link>
                        </div>

                        {/* Pro */}
                        <div className="p-8 rounded-3xl bg-slate-800/40 border border-slate-700/80 hover:border-slate-500 transition-all flex flex-col md:h-[450px]">
                            <div className="mb-6">
                                <h3 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">Pro <Zap className="w-5 h-5 text-amber-400" /></h3>
                                <p className="text-sm text-slate-400 mb-6 h-5">大容量・多人数による大規模運用へ</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-white">¥50,000</span>
                                    <span className="text-sm text-slate-500">/ 月</span>
                                </div>
                            </div>
                            <div className="w-full h-px bg-slate-700/50 mb-6"></div>
                            <ul className="space-y-4 mb-8 flex-1">
                                <li className="flex items-start gap-3 text-sm text-slate-300 font-medium"><Check className="w-5 h-5 text-emerald-400 shrink-0" /> 最大20ユーザー利用可能</li>
                                <li className="flex items-start gap-3 text-sm text-slate-300 font-medium"><Check className="w-5 h-5 text-emerald-400 shrink-0" /> 毎月1,000 AIクレジット付与</li>
                                <li className="flex items-start gap-3 text-sm text-slate-300 font-medium"><Check className="w-5 h-5 text-emerald-400 shrink-0" /> ストレージ 100GB (約20万枚)</li>
                                <li className="flex items-start gap-3 text-sm text-slate-300 font-medium"><Check className="w-5 h-5 text-emerald-400 shrink-0" /> バックアップ 30日間保持</li>
                                <li className="flex items-start gap-3 text-sm text-slate-300 font-medium"><Check className="w-5 h-5 text-emerald-400 shrink-0" /> フル機能・高度な分析レポート</li>
                            </ul>
                            <Link to="/signup" className="w-full py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-center transition-all border border-white/5">無料で試す</Link>
                        </div>
                    </div>
                </section>

                {/* Detailed Feature Comparison */}
                <section className="max-w-7xl mx-auto px-4 md:px-8 py-20 border-t border-white/5 bg-slate-900/20">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl md:text-4xl font-black text-white mb-4">プラン別詳細比較</h2>
                        <p className="text-slate-400">各プランの制限と提供機能の詳細をご確認いただけます。</p>
                    </div>

                    <div className="overflow-x-auto rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="p-6 text-sm font-bold text-slate-400 uppercase tracking-widest">機能・リソース</th>
                                    <th className="p-6 text-xl font-bold text-white text-center">Lite</th>
                                    <th className="p-6 text-xl font-bold text-indigo-400 text-center">Plus</th>
                                    <th className="p-6 text-xl font-bold text-white text-center">Pro</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                <tr>
                                    <td className="p-6 text-slate-300 font-medium">最大ユーザー数</td>
                                    <td className="p-6 text-white text-center font-bold">2 名</td>
                                    <td className="p-6 text-white text-center font-bold">10 名</td>
                                    <td className="p-6 text-white text-center font-bold">20 名</td>
                                </tr>
                                <tr>
                                    <td className="p-6 text-slate-300 font-medium">月間AIクレジット</td>
                                    <td className="p-6 text-white text-center font-bold">100</td>
                                    <td className="p-6 text-indigo-300 text-center font-bold">500</td>
                                    <td className="p-6 text-white text-center font-bold">1,000</td>
                                </tr>
                                <tr>
                                    <td className="p-6 text-slate-300 font-medium">データバックアップ期間</td>
                                    <td className="p-6 text-white text-center">7 日間</td>
                                    <td className="p-6 text-white text-center">7 日間</td>
                                    <td className="p-6 text-amber-400 text-center font-bold">30 日間</td>
                                </tr>
                                <tr>
                                    <td className="p-6 text-slate-300 font-medium">ストレージ容量</td>
                                    <td className="p-6 text-white text-center">5 GB<br /><span className="text-[10px] text-slate-500">(約1万枚相当)</span></td>
                                    <td className="p-6 text-white text-center">20 GB<br /><span className="text-[10px] text-slate-500">(約4万枚相当)</span></td>
                                    <td className="p-6 text-amber-400 text-center font-bold">100 GB<br /><span className="text-[10px] text-amber-900/60 font-medium">(約20万枚相当)</span></td>
                                </tr>
                                <tr>
                                    <td className="p-6 text-slate-300 font-medium">注文書自動OCR解析</td>
                                    <td className="p-6 text-center"><Check className="mx-auto w-5 h-5 text-emerald-400" /></td>
                                    <td className="p-6 text-center"><Check className="mx-auto w-5 h-5 text-emerald-400" /></td>
                                    <td className="p-6 text-center"><Check className="mx-auto w-5 h-5 text-emerald-400" /></td>
                                </tr>
                                <tr>
                                    <td className="p-6 text-slate-300 font-medium">図面・工程管理機能</td>
                                    <td className="p-6 text-center"><Check className="mx-auto w-5 h-5 text-emerald-400" /></td>
                                    <td className="p-6 text-center"><Check className="mx-auto w-5 h-5 text-emerald-400" /></td>
                                    <td className="p-6 text-center"><Check className="mx-auto w-5 h-5 text-emerald-400" /></td>
                                </tr>
                                <tr>
                                    <td className="p-6 text-slate-300 font-medium">高度なデータ分析・レポート</td>
                                    <td className="p-6 text-center"><span className="text-slate-600">-</span></td>
                                    <td className="p-6 text-center"><span className="text-slate-600">-</span></td>
                                    <td className="p-6 text-center"><Check className="mx-auto w-5 h-5 text-emerald-400" /></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Role Permissions Section */}
                <section className="max-w-7xl mx-auto px-4 md:px-8 py-20 border-t border-white/5">
                    <div className="flex flex-col md:flex-row gap-12 items-center">
                        <div className="flex-1">
                            <h2 className="text-2xl md:text-4xl font-black text-white mb-6">組織に合わせた柔軟な権限設定</h2>
                            <p className="text-slate-400 leading-relaxed mb-8">
                                一般ユーザー、管理者、システム管理者の3段階の権限をご用意。現場担当者からIT責任者まで、それぞれの役割に合わせた最適なアクセス制御を実現します。助
                            </p>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="p-5 rounded-2xl bg-white/5 border border-white/5">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center font-bold text-white text-xs">一般</div>
                                        <h4 className="font-bold text-white">一般ユーザー</h4>
                                    </div>
                                    <p className="text-xs text-slate-400">図面の閲覧、担当案件の実績入力・工程更新など、日常的なオペレーションを担当します。※図面登録や解析は行えません。</p>
                                </div>
                                <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xs">管理</div>
                                        <h4 className="font-bold text-white">管理者</h4>
                                    </div>
                                    <p className="text-xs text-slate-400">一般機能に加え、AI読取項目のマッピング設定や自社情報の編集、案件の集約管理など、現場の運用管理を行います。助</p>
                                </div>
                                <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs">全能</div>
                                        <h4 className="font-bold text-white">システム管理者</h4>
                                    </div>
                                    <p className="text-xs text-slate-400">自社内の全設定、ユーザーの招待・削除・**パスワードリセット**、プランの変更、全データの一括出力が可能な、社内の最上位権限者です。助</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 w-full max-w-lg">
                            <div className="p-1 rounded-3xl bg-gradient-to-br from-indigo-500/30 to-blue-500/30">
                                <div className="p-6 md:p-8 rounded-[1.4rem] bg-slate-900 shadow-2xl">
                                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-white/5 pb-4">権限マトリクス</h4>
                                    <ul className="space-y-4">
                                        {[
                                            { action: '注文書・図面の解析/登録', roles: [false, true, true] },
                                            { action: 'IT設定・マッピング管理', roles: [false, true, true] },
                                            { action: 'ユーザー管理・パスワード更新', roles: [false, false, true] },
                                            { action: '自社データの一括出力', roles: [false, false, true] },
                                            { action: '契約プラン・支払い管理', roles: [false, false, true] }
                                        ].map((item, i) => (
                                            <li key={i} className="flex items-center justify-between py-1">
                                                <span className="text-sm text-slate-300 font-medium">{item.action}</span>
                                                <div className="flex gap-4">
                                                    {item.roles.map((r, ri) => (
                                                        <div key={ri} className={`w-3 h-3 rounded-full ${r ? (ri === 2 ? 'bg-blue-500' : ri === 1 ? 'bg-indigo-500' : 'bg-slate-500') : 'bg-white/5'}`}></div>
                                                    ))}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="mt-8 flex justify-center gap-6">
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500"><div className="w-2 h-2 rounded-full bg-slate-500"></div>一般</div>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500"><div className="w-2 h-2 rounded-full bg-indigo-500"></div>管理</div>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500"><div className="w-2 h-2 rounded-full bg-blue-500"></div>システム</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="max-w-4xl mx-auto px-4 md:px-8 py-20">
                    <div className="p-12 rounded-[2.5rem] bg-gradient-to-br from-blue-900/40 via-indigo-900/40 to-cyan-900/40 border border-white/10 text-center relative overflow-hidden">
                        {/* Noise overlay could be added here if desired */}
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-6 relative z-10">今すぐ業務を効率化しよう</h2>
                        <p className="text-lg text-slate-300 mb-10 relative z-10">7日間の無料トライアルで、AiZumenのすべての機能をお試しいただけます。</p>
                        <Link
                            to="/signup"
                            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white text-slate-900 font-bold text-lg hover:bg-slate-100 transition-all shadow-xl relative z-10"
                        >
                            無料で始める
                            <ChevronRight className="w-5 h-5" />
                        </Link>
                    </div>
                </section>
            </main>

            <footer className="border-t border-white/10 py-8 text-center text-slate-500 text-sm relative z-10">
                <div className="flex justify-center items-center gap-2 mb-4">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-slate-300">AiZumen</span>
                </div>
                <div className="flex flex-wrap justify-center gap-4 mb-4">
                    <Link to="/agreement" className="hover:text-slate-300 transition-colors">利用規約</Link>
                    <Link to="/site-policy" className="hover:text-slate-300 transition-colors">プライバシーポリシー</Link>
                    <Link to="/commerce" className="hover:text-slate-300 transition-colors">特定商取引法に基づく表記</Link>
                    <Link to="/protection" className="hover:text-slate-300 transition-colors">データ保護方針</Link>
                </div>
                <p>&copy; {new Date().getFullYear()} AiZumen. All rights reserved.</p>
            </footer>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}} />
        </div>
    );
}

const Sparkles = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
);
