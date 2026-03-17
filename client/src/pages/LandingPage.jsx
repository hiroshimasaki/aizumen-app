import React from 'react';
import { Link } from 'react-router-dom';
import {
    Zap, Brain, CalendarDays, FileText, ChevronRight, Shield, Upload, Cpu,
    CheckCircle, Check, ArrowRight, TrendingUp, Mail, Search, Users,
    MapPin, ShieldCheck, Lock, Clock, Rocket, BarChart3, LayoutDashboard,
    Play, MessageSquare, Info
} from 'lucide-react';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-['Inter'] selection:bg-cyan-500/30 overflow-x-hidden">
            {/* SEO & Meta (Head handled by index.html or Helmet if added) */}

            {/* Global Decor */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-600/10 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            </div>

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/70 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 md:px-12 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <Zap className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-2xl font-['Roboto_Mono'] font-bold tracking-tighter text-white">
                            AiZumen
                        </span>
                    </div>

                    <nav className="hidden md:flex items-center gap-10">
                        {['機能', '解決策', '料金', 'セキュリティ'].map((item) => (
                            <a key={item} href={`#${item}`} className="text-sm font-medium text-lp-text-sub hover:text-lp-accent transition-colors">
                                {item}
                            </a>
                        ))}
                    </nav>

                    <div className="flex items-center gap-4">
                        <Link to="/login" className="px-6 py-2.5 text-sm font-bold text-white hover:text-lp-accent transition-colors">
                            ログイン
                        </Link>
                        <Link to="/signup" className="px-6 py-3 bg-lp-accent text-black font-black text-sm rounded-xl hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all hover:scale-105 active:scale-95">
                            無料トライアル
                        </Link>
                    </div>
                </div>
            </header>

            <main className="relative z-10">
                {/* Section 1: Hero */}
                <section className="relative pt-40 pb-24 px-6 md:px-12 container mx-auto flex flex-col items-center text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-lp-accent text-xs font-black mb-10 tracking-widest animate-[fade-in-up_0.8s_ease-out]">
                        <Sparkles className="w-4 h-4" />
                        <span>町工場・製造業のためのAI図面管理システム</span>
                    </div>

                    <h1 className="text-5xl md:text-8xl font-['Roboto_Mono'] font-bold text-white mb-8 leading-[1.1] tracking-tight animate-[fade-in-up_0.8s_ease-out_0.1s_forwards] opacity-0">
                        見積業務の「属人化」と<br />
                        <span className="text-lp-accent inline-block drop-shadow-[0_0_15px_rgba(0,229,255,0.3)]">
                            「非効率」をAIで一掃する。
                        </span>
                    </h1>

                    <p className="max-w-3xl text-lg md:text-2xl text-lp-text-sub mb-12 leading-relaxed animate-[fade-in-up_0.8s_ease-out_0.2s_forwards] opacity-0 font-medium">
                        現場を知る経営者が開発した、町工場のためのAI図面管理システム。<br className="hidden md:block" />
                        紙図面やFAXからでもAIが自動解析。見積に1時間かかっていたのが、1.5分に。
                    </p>

                    <div className="flex flex-col sm:flex-row gap-6 mb-20 animate-[fade-in-up_0.8s_ease-out_0.3s_forwards] opacity-0">
                        <Link to="/signup" className="px-10 py-5 bg-lp-accent text-black font-black text-xl rounded-2xl shadow-[0_0_30px_rgba(0,229,255,0.3)] hover:shadow-[0_0_40px_rgba(0,229,255,0.5)] transition-all hover:scale-105 group relative overflow-hidden">
                            <span className="relative z-10 flex items-center gap-3">
                                無料トライアルを始める
                                <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                            </span>
                        </Link>
                        <a href="#demo-video" className="px-10 py-5 bg-white/5 border border-white/10 text-white font-black text-xl rounded-2xl hover:bg-white/10 transition-all flex items-center gap-3">
                            <Play className="w-6 h-6 fill-current" />
                            デモを見る
                        </a>
                    </div>

                    {/* Simple Flow Visual */}
                    <div className="max-w-5xl w-full p-8 md:p-12 rounded-[3rem] bg-gradient-to-b from-white/5 to-transparent border border-white/10 animate-[fade-in-up_1s_ease-out_0.5s_forwards] opacity-0">
                        <div className="grid grid-cols-1 md:grid-cols-5 items-center gap-8">
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center shadow-xl">
                                    <FileText className="w-10 h-10 text-lp-text-sub" />
                                </div>
                                <span className="text-sm font-bold">見積依頼・図面</span>
                            </div>
                            <div className="flex justify-center">
                                <ArrowRight className="w-8 h-8 text-lp-accent hidden md:block" />
                                <ChevronRight className="w-8 h-8 text-lp-accent md:hidden" />
                            </div>
                            <div className="flex flex-col items-center gap-4 scale-110">
                                <div className="w-24 h-24 rounded-[2rem] bg-lp-accent/10 border-2 border-lp-accent flex items-center justify-center shadow-[0_0_30px_rgba(0,229,255,0.2)]">
                                    <Brain className="w-12 h-12 text-lp-accent" />
                                </div>
                                <span className="text-lg font-black text-lp-accent">AI自動解析</span>
                            </div>
                            <div className="flex justify-center">
                                <ArrowRight className="w-8 h-8 text-lp-accent hidden md:block" />
                                <ChevronRight className="w-8 h-8 text-lp-accent md:hidden" />
                            </div>
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center shadow-xl">
                                    <TrendingUp className="w-10 h-10 text-lp-text-sub" />
                                </div>
                                <span className="text-sm font-bold">1秒で過去検索</span>
                            </div>
                        </div>
                        <div className="mt-12 text-center text-lp-text-sub text-sm italic">
                            現場を知り尽くした経営者が、自らの経験から生み出した「本当に使える」DXの形。
                        </div>
                    </div>

                </section>

                {/* Section 1.5: Demo Video */}
                <section id="demo-video" className="py-24 px-6 md:px-12 scroll-mt-24">
                    <div className="max-w-5xl mx-auto">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-lp-accent to-blue-600 rounded-[3rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                            <div className="relative rounded-[2.5rem] bg-[#0a0a0a] border border-white/10 overflow-hidden shadow-2xl">
                                <div className="aspect-video w-full">
                                    <iframe
                                        className="w-full h-full"
                                        src="https://www.youtube.com/embed/6vERhJV5v2E"
                                        title="AiZumen Demo Video"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                    ></iframe>
                                </div>
                                <div className="p-8 md:p-10 bg-gradient-to-b from-white/[0.02] to-transparent">
                                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                        <div className="text-left">
                                            <h3 className="text-2xl font-bold text-white mb-2">実際の操作画面を1.5分で体感</h3>
                                            <p className="text-lp-text-sub font-medium">図面のAI解析から過去検索、見積作成までの一連の流れをご覧いただけます。</p>
                                        </div>
                                        <Link to="/signup" className="px-8 py-4 bg-lp-accent text-black font-black rounded-xl hover:scale-105 transition-all shadow-lg shadow-cyan-500/20 shrink-0">
                                            今すぐ無料で試す
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>


                {/* Section 2: Pain Points */}
                <section className="py-24 px-6 md:px-12 bg-white/[0.02]">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-20">
                            <h2 className="text-4xl md:text-6xl font-['Roboto_Mono'] font-bold text-white mb-6">
                                こんな課題、抱えていませんか？
                            </h2>
                            <p className="text-xl text-lp-text-sub font-medium">
                                町工場の経営者の80%が、見積業務の効率化に課題を感じています。
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            {[
                                { icon: Clock, title: '見積回答の遅延', desc: '過去の図面を探すだけで1時間。受注機会を逃している。', accent: 'bg-red-500/10 text-[#ff6b6b]' },
                                { icon: Users, title: 'ベテランへの依存', desc: '「あの図面、前いくらだった？」がベテランにしか分からない。', accent: 'bg-indigo-500/10 text-indigo-400' },
                                { icon: FileText, title: '紙・FAXの山', desc: '紙図面やFAXでの依頼がデジタル化されず、管理が限界。', accent: 'bg-blue-500/10 text-blue-400' },
                                { icon: BarChart3, title: '利益の不透明性', desc: '見積と実績の乖離が分からず、「儲からない仕事」を無意識に受けている。', accent: 'bg-amber-500/10 text-amber-400' },
                            ].map((item, i) => (
                                <div key={i} className="p-10 rounded-[2.5rem] bg-[#0a0a0a] border border-white/5 hover:border-white/10 transition-all group">
                                    <div className={`w-16 h-16 rounded-2xl ${item.accent} flex items-center justify-center mb-8 group-hover:scale-110 transition-transform`}>
                                        <item.icon className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-4">{item.title}</h3>
                                    <p className="text-lp-text-sub leading-relaxed font-medium">{item.desc}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-20 max-w-3xl mx-auto p-8 rounded-3xl bg-[#ff6b6b]/5 border border-[#ff6b6b]/10 text-center">
                            <p className="text-xl md:text-2xl font-bold leading-relaxed text-white">
                                見積業務は、製造業の「入口」です。<br />
                                ここが遅い、属人化している、不透明だと、全社の経営効率が落ちます。
                            </p>
                        </div>
                    </div>
                </section>

                {/* Section 3: Solution */}
                <section className="py-32 px-6 md:px-12 relative overflow-hidden" id="解決策">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-lp-accent/5 blur-[120px] pointer-events-none" />

                    <div className="max-w-7xl mx-auto relative z-10">
                        <div className="text-center mb-24">
                            <h2 className="text-4xl md:text-6xl font-['Roboto_Mono'] font-bold text-white mb-8">
                                AiZumenが、すべてを変えます。
                            </h2>
                            <p className="text-xl text-lp-text-sub font-medium max-w-3xl mx-auto">
                                技術は背景に。経営者が必要なのは「複雑な説明」ではなく、「確実な結果」です。
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                            {[
                                {
                                    icon: Rocket, title: '「探す」時間をゼロに',
                                    desc: 'AI自動解析で、図面から必要な情報を瞬時に抽出。過去の類似図面を1秒で検索。'
                                },
                                {
                                    icon: BarChart3, title: '「判断」の質を最大化',
                                    desc: 'データに基づいた正確な見積で、利益を確実に確保。'
                                },
                                {
                                    icon: Users, title: '組織力を強化',
                                    desc: '若手でもベテラン並みの見積が可能。属人化を解消。'
                                },
                            ].map((item, i) => (
                                <div key={i} className="text-center group">
                                    <div className="w-24 h-24 rounded-[2rem] bg-lp-accent/5 border border-lp-accent/20 flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(0,229,255,0.05)] group-hover:shadow-[0_0_60px_rgba(0,229,255,0.15)] transition-all">
                                        <item.icon className="w-12 h-12 text-lp-accent" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-6">{item.title}</h3>
                                    <p className="text-lp-text-sub text-lg leading-relaxed font-medium">{item.desc}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-32 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                            <div className="p-10 rounded-[3rem] bg-gradient-to-br from-lp-accent/10 to-transparent border border-lp-accent/20 text-center">
                                <div className="text-5xl md:text-7xl font-bold text-lp-accent mb-2">90%</div>
                                <div className="text-xl font-black text-white uppercase tracking-widest">見積作業時間を削減</div>
                            </div>
                            <div className="p-10 rounded-[3rem] bg-gradient-to-br from-lp-accent/10 to-transparent border border-lp-accent/20 text-center text-white">
                                <div className="text-5xl md:text-7xl font-bold text-lp-accent mb-2">90%</div>
                                <div className="text-xl font-black text-white uppercase tracking-widest">入力工数を削減</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 4: Features */}
                <section className="py-24 px-6 md:px-12 bg-white/[0.01]" id="機能">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-32">
                            <h2 className="text-4xl md:text-6xl font-['Roboto_Mono'] font-bold text-white">
                                AiZumenの3つのコア機能
                            </h2>
                        </div>

                        <div className="space-y-48">
                            {/* Feature 1 */}
                            <div className="grid md:grid-cols-2 gap-20 items-center">
                                <div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lp-accent/10 border border-lp-accent/20 text-lp-accent text-xs font-black mb-6 uppercase tracking-widest">
                                        Feature 01: AI Vision
                                    </div>
                                    <h3 className="text-3xl md:text-5xl font-bold text-white mb-8 leading-tight">
                                        紙図面やFAXも読み解く、<br />AI Vision テクノロジー。
                                    </h3>
                                    <p className="text-xl text-lp-text-sub font-medium leading-relaxed mb-10">
                                        スマホで撮った紙図面や、複合機から届くFAX。ドラッグ&ドロップするだけでAIが品名、材質、納期、手書き指示まで自動抽出。転記作業から解放されます。
                                    </p>
                                    <div className="p-8 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-xs text-lp-text-sub font-bold uppercase tracking-widest mb-1">導入効果</span>
                                            <span className="text-3xl font-black text-lp-accent">データ入力工数 90% 削減</span>
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-lp-accent/20 flex items-center justify-center">
                                            <TrendingUp className="w-6 h-6 text-lp-accent" />
                                        </div>
                                    </div>
                                </div>
                                <div className="relative group">
                                    <div className="absolute -inset-1 bg-lp-accent rounded-[2.5rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                                    <img src="/assets/lp/feature-ai-ocr.png" alt="AI自動解析" className="relative rounded-[2rem] border border-white/10 shadow-2xl transition-transform group-hover:scale-[1.01]" />
                                </div>
                            </div>

                            {/* Feature 2 */}
                            <div className="grid md:grid-cols-2 gap-20 items-center">
                                <div className="order-2 md:order-1 relative group">
                                    <div className="absolute -inset-1 bg-blue-500 rounded-[2.5rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                                    <img src="/assets/lp/feature-search.png" alt="形状検索" className="relative rounded-[2rem] border border-white/10 shadow-2xl transition-transform group-hover:scale-[1.01]" />
                                </div>
                                <div className="order-1 md:order-2">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black mb-6 uppercase tracking-widest">
                                        Feature 02: pgvector
                                    </div>
                                    <h3 className="text-3xl md:text-5xl font-bold text-white mb-8 leading-tight">
                                        「あの時の図面」を、<br />もう迷わず呼び出す。
                                    </h3>
                                    <p className="text-xl text-lp-text-sub font-medium leading-relaxed mb-10">
                                        完全一致なら<strong>1秒</strong>、AIによる類似形状検索なら<strong>数十秒</strong>。過去の見積データを瞬時に提示。もうベテランを探し回る必要はありません。
                                    </p>
                                    <div className="p-8 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-xs text-lp-text-sub font-bold uppercase tracking-widest mb-1">導入効果</span>
                                            <span className="text-3xl font-black text-blue-400">検索時間 99% 削減</span>
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                                            <Search className="w-6 h-6 text-blue-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Feature 3 */}
                            <div className="grid md:grid-cols-2 gap-20 items-center">
                                <div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black mb-6 uppercase tracking-widest">
                                        Feature 03: Analytics
                                    </div>
                                    <h3 className="text-3xl md:text-5xl font-bold text-white mb-8 leading-tight">
                                        「儲かる仕事」を可視化し、<br />経営判断をデータで支える。
                                    </h3>
                                    <p className="text-xl text-lp-text-sub font-medium leading-relaxed mb-10">
                                        見積vs実績の乖離を自動計算。AIが推奨見積額を提案。経営ダッシュボードで利益体質への転換と迅速な意思決定を支援します。
                                    </p>
                                    <div className="p-8 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-xs text-lp-text-sub font-bold uppercase tracking-widest mb-1">導入効果</span>
                                            <span className="text-3xl font-black text-emerald-400">利益体質への転換</span>
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                            <LayoutDashboard className="w-6 h-6 text-emerald-400" />
                                        </div>
                                    </div>
                                </div>
                                <div className="relative group">
                                    <div className="absolute -inset-1 bg-emerald-500 rounded-[2.5rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                                    <img src="/assets/lp/feature-analysis.png" alt="経営分析" className="relative rounded-[2rem] border border-white/10 shadow-2xl transition-transform group-hover:scale-[1.01]" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 5: ROI */}
                <section className="py-32 px-6 md:px-12 bg-white/[0.02]">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-24">
                            <h2 className="text-4xl md:text-6xl font-['Roboto_Mono'] font-bold text-white mb-6">
                                年間160万円以上のコスト削減。<br className="hidden lg:block" />
                                AiZumenは「プラス」の投資です。
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                            <div className="space-y-8">
                                <div className="p-10 rounded-3xl bg-[#0a0a0a] border border-white/5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-lp-accent/5 blur-3xl rounded-full" />
                                    <div className="text-lp-text-sub font-bold uppercase tracking-widest mb-4">見積作業時間（1件あたり）</div>
                                    <div className="flex items-end gap-6 text-white mb-8">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold opacity-50">従来</span>
                                            <span className="text-4xl font-black">15分</span>
                                        </div>
                                        <ArrowRight className="w-10 h-10 mb-2 text-lp-accent" />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-lp-accent">AiZumen</span>
                                            <span className="text-6xl font-black text-lp-accent">1.5分</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-white/5 h-4 rounded-full overflow-hidden">
                                        <div className="bg-lp-accent h-full w-[10%] shadow-[0_0_10px_rgba(0,229,255,0.5)]" />
                                    </div>
                                    <p className="mt-4 text-lp-accent font-black text-right tracking-widest">90% 削減</p>
                                </div>

                                <div className="p-10 rounded-3xl bg-lp-accent text-black overflow-hidden relative group">
                                    <div className="absolute -right-10 -bottom-10 opacity-10 blur-xl transition-transform group-hover:scale-110">
                                        <TrendingUp size={200} />
                                    </div>
                                    <div className="relative z-10">
                                        <div className="font-black text-lg uppercase tracking-widest mb-2 opacity-70">年間想定人件費削減（1日10件、時給3,000円換算）</div>
                                        <div className="text-7xl md:text-8xl font-black tracking-tighter mb-4">
                                            <span className="text-4xl">¥</span>1,620,000
                                        </div>
                                        <p className="font-bold text-xl opacity-80 italic">初期投資0円。初月から、人件費削減が始まります。</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {[
                                    { title: '見積回答スピード向上による「受注機会」の最大化', desc: '早い回答が、お客様からの信頼と成約に直結します。' },
                                    { title: '手戻り・修正の削減による「品質向上」', desc: 'AIによる自動抽出で入力ミスを排除します。' },
                                    { title: '属人化の解消による「組織の安定性」', desc: 'ベテランがいなくても業務が止まらない体制を構築。' },
                                ].map((item, i) => (
                                    <div key={i} className="flex gap-6 items-start">
                                        <div className="w-10 h-10 rounded-full bg-lp-accent flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20">
                                            <Check className="w-6 h-6 text-black" />
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-black text-white mb-2 tracking-tight">{item.title}</h4>
                                            <p className="text-lp-text-sub font-medium leading-relaxed">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 6: Security & Trust */}
                <section className="py-32 px-6 md:px-12 relative overflow-hidden" id="セキュリティ">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-20">
                            <h2 className="text-4xl md:text-6xl font-['Roboto_Mono'] font-bold text-white mb-8">
                                大手SIerの知見を活かした、<br />最高レベルのデータ保護。
                            </h2>
                            <p className="text-xl text-lp-text-sub font-medium max-w-2xl mx-auto">
                                「ITは不安」という懸念は、もう必要ありません。現場を知り、技術を知る経営者が作ったからこそ、安心して任せられます。
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
                            <div className="p-12 rounded-[3.5rem] bg-gradient-to-br from-indigo-500/10 to-transparent border border-white/10 flex flex-col items-center text-center">
                                <ShieldCheck className="w-20 h-20 text-indigo-400 mb-8" />
                                <h3 className="text-3xl font-black text-white mb-6 tracking-tight">徹底したデータ保護</h3>
                                <div className="space-y-4 text-lp-text-sub font-medium text-lg text-left">
                                    <p className="flex items-center gap-3"><Check className="text-indigo-400" /> 日本国内リージョンでのデータ運用</p>
                                    <p className="flex items-center gap-3"><Check className="text-indigo-400" /> 通信および保存データの強力な暗号化</p>
                                    <p className="flex items-center gap-3"><Check className="text-indigo-400" /> AI学習へのデータ非使用を徹底</p>
                                </div>
                                <p className="mt-8 text-indigo-300 font-bold">機密性の高い図面データを、<br />鉄壁のセキュリティで守ります。</p>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                {[
                                    { icon: ShieldCheck, title: '完全なるデータ分離', desc: 'PostgreSQL RLSによる完全なデータ分離により、他社との混入を物理的に防ぎます。' },
                                    { icon: FileText, title: '監査ログの完全記録', desc: 'いつ、誰が、何をしたか、すべての操作を漏らさず記録。不正アクセスを許しません。' },
                                    { icon: Lock, title: '多要素認証（管理機能）', desc: 'システム管理者（SU）向けには多要素認証（MFA）を導入し、権限を厳格に保護。' },
                                ].map((item, i) => (
                                    <div key={i} className="p-8 rounded-3xl bg-white/5 border border-white/10 flex items-center gap-6">
                                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center shrink-0">
                                            <item.icon className="w-7 h-7 text-indigo-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-bold text-white mb-1 group-hover:text-lp-accent transition-colors">{item.title}</h4>
                                            <p className="text-lp-text-sub text-sm font-medium leading-relaxed">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 7: Pricing */}
                <section className="py-32 px-6 md:px-12 relative overflow-hidden bg-white/[0.01]" id="料金">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-lp-accent/30 to-transparent" />

                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-24">
                            <h2 className="text-4xl md:text-6xl font-['Roboto_Mono'] font-bold text-white mb-8">
                                初期費用0円から。
                            </h2>
                            <p className="text-xl text-lp-text-sub font-medium max-w-3xl mx-auto">
                                「高い初期投資」は不要です。無料トライアルで効果を実感してから、本導入を決めてください。
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch pt-12">
                            {[
                                { name: 'Lite', price: '10,000', users: '2名', credit: '100', storage: '5GB', desc: '少人数向け' },
                                { name: 'Plus', price: '30,000', users: '10名', credit: '500', storage: '20GB', popular: true, desc: '標準的なチーム運用向け' },
                                { name: 'Pro', price: '50,000', users: '20名', credit: '1,000', storage: '100GB', desc: '大規模・詳細分析向け' },
                            ].map((plan, i) => (
                                <div key={i} className={`p-10 rounded-[2.5rem] bg-[#0a0a0a] border ${plan.popular ? 'border-lp-accent shadow-[0_0_40px_rgba(0,229,255,0.1)]' : 'border-white/10'} flex flex-col relative`}>
                                    {plan.popular && (
                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-lp-accent text-black text-xs font-black px-6 py-1.5 rounded-full uppercase tracking-tighter shadow-lg">
                                            圧倒的人気
                                        </div>
                                    )}
                                    <h3 className="text-2xl font-['Roboto_Mono'] font-bold text-white mb-2">{plan.name}</h3>
                                    <p className="text-lp-text-sub font-medium mb-8 text-sm">{plan.desc}</p>

                                    <div className="flex items-baseline gap-1 mb-10">
                                        <span className="text-5xl font-black text-white">¥{plan.price}</span>
                                        <span className="text-sm font-bold text-lp-text-sub">/ 月 (税込)</span>
                                    </div>

                                    <div className="w-full h-px bg-white/10 mb-10" />

                                    <ul className="space-y-6 mb-12 flex-1">
                                        <li className="flex items-center gap-3 text-sm font-medium"><Check className="w-5 h-5 text-lp-accent" /> 最大 {plan.users} 利用可能</li>
                                        <li className="flex items-center gap-3 text-sm font-medium"><Check className="w-5 h-5 text-lp-accent" /> 毎月 {plan.credit} クレジット付与</li>
                                        <li className="flex items-center gap-3 text-sm font-medium"><Check className="w-5 h-5 text-lp-accent" /> ストレージ {plan.storage}</li>
                                        <li className="flex items-center gap-3 text-sm font-medium text-lp-text-sub/50"><Check className="w-5 h-5" /> バックアップ対応</li>
                                        {plan.name === 'Pro' && (
                                            <li className="flex items-center gap-3 text-sm font-medium"><Check className="w-5 h-5 text-lp-accent" /> 高度な経営分析機能</li>
                                        )}
                                    </ul>

                                    <Link to="/signup" className={`w-full py-5 rounded-2xl font-black text-lg transition-all text-center ${plan.popular ? 'bg-lp-accent text-black hover:scale-[1.03]' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'}`}>
                                        無料で試す
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
                
                {/* Section 08: Onboarding Flow & Support */}
                <section className="py-32 px-6 md:px-12 relative overflow-hidden bg-white/[0.02]">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-24">
                            <h2 className="text-4xl md:text-6xl font-['Roboto_Mono'] font-bold text-white mb-8">
                                導入は、驚くほどスムーズです。
                            </h2>
                            <p className="text-xl text-lp-text-sub font-medium max-w-2xl mx-auto">
                                ITの専門知識は不要です。町工場の現場を知り尽くしたスタッフが、あなたの会社のDXを最初から最後まで伴走支援します。
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
                            {/* Connectors (Desktop) */}
                            <div className="hidden md:block absolute top-12 left-[30%] right-[30%] h-[2px] bg-gradient-to-r from-lp-accent/50 via-lp-accent/20 to-lp-accent/50 z-0" />

                            {[
                                { step: '01', title: 'アカウント作成', desc: 'わずか3分で登録完了。クレジットカードは不要です。', icon: Users },
                                { step: '02', title: '図面アップロード', desc: '既存の図面をアップロード。AIが自動で解析・データ化します。', icon: Upload },
                                { step: '03', title: '運用開始', desc: '過去検索やAI見積を、その日から体感いただけます。', icon: Rocket },
                            ].map((item, i) => (
                                <div key={i} className="relative z-10 flex flex-col items-center text-center group">
                                    <div className="w-24 h-24 rounded-[2rem] bg-[#0a0a0a] border-2 border-lp-accent/30 flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(0,229,255,0.1)] group-hover:border-lp-accent transition-all duration-500">
                                        <item.icon className="w-10 h-10 text-lp-accent" />
                                        <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-lp-accent text-black font-black flex items-center justify-center text-lg shadow-lg">
                                            {item.step}
                                        </div>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-4">{item.title}</h3>
                                    <p className="text-lp-text-sub text-lg leading-relaxed font-medium">{item.desc}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-24 p-12 rounded-[4rem] bg-gradient-to-br from-white/5 to-transparent border border-white/10 flex flex-col md:flex-row items-center gap-12">
                            <div className="w-24 h-24 rounded-full bg-lp-accent/10 flex items-center justify-center shrink-0">
                                <Users className="w-12 h-12 text-lp-accent" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-bold text-white mb-4">知見が循環する「ユーザーコミュニティ」</h4>
                                <p className="text-lp-text-sub text-lg leading-relaxed font-medium">
                                    専任スタッフによるサポートに加え、導入企業同士が活用ノウハウを直接共有できる専用フォーラムをご用意。
                                    「現場のこの課題、どう解決した？」といったリアルな知見を、同じ製造業の仲間と交換し、共に成長できる環境を提供します。
                                </p>
                            </div>
                        </div>
                    </div>
                </section>


                {/* Section 10: FAQ */}
                <section className="py-32 px-6 md:px-12" id="faq">
                    <div className="max-w-4xl mx-auto text-white">
                        <div className="text-center mb-20 text-white">
                            <h2 className="text-4xl md:text-6xl font-['Roboto_Mono'] font-bold mb-6 text-white">よくある質問</h2>
                        </div>

                        <div className="space-y-4">
                            {[
                                { q: '導入に、どのくらいの期間がかかりますか？', a: 'アカウント作成後すぐにご利用いただけます。初期設定を含めても、多くのお客様が数時間から1日で本稼働を開始されています。' },
                                { q: '既存の生産管理システムと連携できますか？', a: 'CSVインポート/エクスポート機能を標準搭載しています。' },
                                { q: 'セキュリティは大丈夫ですか？', a: 'はい、日本国内リージョンでのデータ管理、最新の暗号化技術、AI学習への不使用を徹底しており、企業の機密情報を強固に保護します。' },
                                { q: '初期費用が0円というのは本当ですか？', a: '本当です。導入時のツール費用や設定費用は一切かかりません。月額のサブスクリプション料金のみでご利用いただけます。' },
                                { q: '無料トライアルの期間は？', a: '30日間、すべての機能を無料でお試しいただけます。クレジットカード登録も不要ですので、お気軽にお試しください。' },
                            ].map((faq, i) => (
                                <details key={i} className="group p-8 rounded-2xl bg-white/[0.03] border border-white/10 [&_summary::-webkit-details-marker]:hidden">
                                    <summary className="flex items-center justify-between cursor-pointer focus:outline-none">
                                        <h3 className="text-xl font-bold flex items-center gap-4">
                                            <span className="text-lp-accent font-black text-2xl">Q.</span>
                                            {faq.q}
                                        </h3>
                                        <ChevronRight className="w-6 h-6 text-lp-text-sub transition-transform group-open:rotate-90" />
                                    </summary>
                                    <div className="mt-6 pl-10 text-lp-text-sub leading-relaxed font-medium border-l-2 border-lp-accent/30">
                                        {faq.a}
                                    </div>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Section 11: Final CTA */}
                <section className="py-32 px-6 md:px-12 mb-20">
                    <div className="max-w-5xl mx-auto rounded-[4rem] bg-gradient-to-br from-indigo-900/60 to-blue-900/40 p-16 md:p-24 text-center border border-white/10 shadow-3xl shadow-blue-900/40 relative overflow-hidden group">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-lp-accent/10 blur-[150px] pointer-events-none group-hover:scale-110 transition-transform duration-1000" />

                        <h2 className="text-4xl md:text-7xl font-['Roboto_Mono'] font-bold text-white mb-8 relative z-10 leading-tight">
                            今すぐ業務を<br className="md:hidden" />効率化しよう。
                        </h2>
                        <p className="text-xl md:text-2xl text-blue-200 mb-12 relative z-10 max-w-2xl mx-auto font-medium">
                            30日間の完全無料トライアル。クレジットカード不要。あなたの工場のDXは、ここから始まります。
                        </p>

                        <div className="flex flex-col sm:flex-row gap-6 justify-center relative z-10">
                            <Link to="/signup" className="px-12 py-6 bg-lp-accent text-black font-black text-2xl rounded-3xl shadow-[0_0_40px_rgba(0,229,255,0.4)] hover:shadow-[0_0_60px_rgba(0,229,255,0.6)] transition-all hover:scale-105 active:scale-95">
                                無料トライアルを始める
                            </Link>
                        </div>
                        <div className="mt-10 flex items-center justify-center gap-8 text-blue-200/60 font-bold uppercase tracking-[0.2em] text-sm relative z-10">
                            <span>No Credit Card</span>
                            <span className="w-1 h-1 rounded-full bg-blue-200/20" />
                            <span>Full Features</span>
                            <span className="w-1 h-1 rounded-full bg-blue-200/20" />
                            <span>Cancel Anytime</span>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/10 pt-24 pb-12 px-6 md:px-12 text-white">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-20">
                        <div className="col-span-1 md:col-span-2">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 bg-lp-accent rounded-xl flex items-center justify-center">
                                    <Zap className="w-6 h-6 text-black" />
                                </div>
                                <span className="text-2xl font-['Roboto_Mono'] font-bold tracking-tighter text-white">
                                    AiZumen
                                </span>
                            </div>
                            <p className="text-lp-text-sub font-medium max-w-sm mb-10 leading-relaxed text-lg">
                                見積を1時間から1.5分へ。Google Gemini AIと pgvector を活用した、製造業・町工場のための次世代図面管理・見積支援システム。
                            </p>
                            <div className="flex gap-4">
                                {['Twitter', 'LinkedIn', 'Facebook'].map(social => (
                                    <a key={social} href="#" className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center hover:bg-lp-accent hover:text-black transition-all">
                                        <Info className="w-6 h-6 shrink-0" />
                                    </a>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="font-black text-sm uppercase tracking-widest text-lp-accent mb-8">サービス</h4>
                            <ul className="space-y-6 text-lp-text-sub font-medium">
                                <li><a href="#機能" className="hover:text-lp-accent transition-colors">機能紹介</a></li>
                                <li><a href="#解決策" className="hover:text-lp-accent transition-colors">解決策</a></li>
                                <li><a href="#料金" className="hover:text-lp-accent transition-colors">料金プラン</a></li>
                                <li><Link to="/login" className="hover:text-lp-accent transition-colors">ログイン</Link></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-black text-sm uppercase tracking-widest text-lp-accent mb-8">サポート</h4>
                            <ul className="space-y-6 text-lp-text-sub font-medium">
                                <li><a href="#faq" className="hover:text-lp-accent transition-colors">よくある質問</a></li>
                                <li><a href="#セキュリティ" className="hover:text-lp-accent transition-colors">セキュリティ</a></li>
                                <li><Link to="/site-policy" className="hover:text-lp-accent transition-colors">個人情報保護方針</Link></li>
                                <li><Link to="/agreement" className="hover:text-lp-accent transition-colors">利用規約</Link></li>
                                <li><Link to="/commerce" className="hover:text-lp-accent transition-colors">特定商取引法に基づく表記</Link></li>
                                <li><Link to="/protection" className="hover:text-lp-accent transition-colors">情報セキュリティ方針</Link></li>
                                <li><a href="mailto:info@aizumen.com" className="hover:text-lp-accent transition-colors">お問い合わせ</a></li>
                            </ul>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between pt-12 border-t border-white/5 gap-8">
                        <p className="text-lp-text-sub text-sm font-medium">&copy; {new Date().getFullYear()} AiZumen Project. Developed by a Manufacturer for Manufacturers.</p>
                        <div className="text-lp-text-sub text-xs font-bold leading-relaxed max-w-lg md:text-right">
                            ※当サービスは Google Gemini API を利用していますが、Google社とは独立した企業・プロジェクトによって運営されています。
                        </div>
                    </div>
                </div>
            </footer>

            {/* Global Keyframes & Overwrites */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(40px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .font-roboto-mono { font-family: 'Roboto Mono', monospace; }
                html { scroll-behavior: smooth; }
            `}} />
        </div>
    );
}

const Sparkles = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
);
