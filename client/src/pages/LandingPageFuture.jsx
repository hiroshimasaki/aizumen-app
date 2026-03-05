import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, Brain, CalendarDays, FileText, ChevronRight, Shield, Upload, Cpu, CheckCircle, Check, ArrowRight } from 'lucide-react';

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
                        <span>AI図面解析・見積もりSaaS</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight tracking-tight opacity-0 animate-[fade-in-up_0.8s_ease-out_0.1s_forwards]">
                        図面見積もりを、<br className="md:hidden" />
                        <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">AIで一瞬に。</span>
                    </h1>
                    <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 mb-10 opacity-0 animate-[fade-in-up_0.8s_ease-out_0.2s_forwards]">
                        製造業の見積もり業務を革新するクラウドサービス。AIが図面から加工内容や材料を自動抽出し、見積書とガントチャートを瞬時に生成します。
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
                <div className="max-w-5xl mx-auto px-4 mt-6 mb-20 opacity-0 animate-[fade-in-up_1s_ease-out_0.5s_forwards]">
                    <div className="relative rounded-[2rem] overflow-hidden border border-white/10 bg-slate-900/50 backdrop-blur-xl shadow-2xl p-4 md:p-8">
                        {/* Mockup Top Bar */}
                        <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                        </div>
                        {/* Mockup Content Grid */}
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* PDF View Mock */}
                            <div className="rounded-2xl bg-slate-800/50 border border-white/5 p-4 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden group">
                                <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors"></div>
                                <FileText className="w-16 h-16 text-slate-500 mb-4" />
                                <div className="w-3/4 h-3 bg-slate-700/50 rounded-full mb-3"></div>
                                <div className="w-1/2 h-3 bg-slate-700/50 rounded-full mb-8"></div>
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50 animate-pulse"></div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-32 bg-cyan-500/10 rotate-[-15deg] blur-2xl animate-pulse pointer-events-none"></div>
                                <div className="px-5 py-2 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-sm font-bold flex items-center gap-2 z-10 shadow-lg shadow-cyan-500/20 backdrop-blur-md">
                                    <Cpu className="w-4 h-4 animate-spin duration-3000" />
                                    <span>AIが図面を抽出し解析中...</span>
                                </div>
                            </div>
                            {/* Data Extraction Mock */}
                            <div className="space-y-4 flex flex-col justify-center">
                                <div className="p-5 rounded-2xl bg-slate-800/50 border border-emerald-500/20 flex items-center gap-4 transition-all hover:bg-slate-800/80 hover:scale-[1.02]">
                                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="w-1/3 h-2 bg-slate-600 rounded mb-2"></div>
                                        <div className="w-1/4 h-1.5 bg-slate-700 rounded"></div>
                                    </div>
                                    <div className="text-emerald-400 text-xs font-bold uppercase tracking-wider">抽出完了</div>
                                </div>
                                <div className="p-5 rounded-2xl bg-slate-800/50 border border-white/5 flex items-center gap-4 transition-all hover:bg-slate-800/80 hover:scale-[1.02]">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400 font-black">
                                        ¥
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xs text-slate-400 mb-1">見積金額（概算）</div>
                                        <div className="text-xl font-black text-white">12,500 <span className="text-sm font-normal text-slate-500">円</span></div>
                                    </div>
                                </div>
                                <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border border-blue-500/20 mt-4 relative overflow-hidden group hover:scale-[1.02] transition-all">
                                    <div className="absolute right-[-10%] top-[-10%] opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
                                        <CalendarDays className="w-32 h-32 text-blue-400" />
                                    </div>
                                    <div className="text-blue-400 text-xs font-bold mb-1 tracking-widest uppercase">Next Step</div>
                                    <div className="text-white text-lg font-bold flex items-center gap-2">
                                        工程表に自動追加 <ArrowRight className="w-4 h-4 text-cyan-400" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Workflow Section */}
                <section className="max-w-7xl mx-auto px-4 md:px-8 py-20 bg-slate-900/40 border-y border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent"></div>
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold mb-4">
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                            SIMPLE WORKFLOW
                        </div>
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-6">利用の流れ</h2>
                        <p className="text-lg text-slate-400 md:max-w-2xl mx-auto">わずか3ステップ。図面から見積もり・工程管理まで、すべての業務がブラウザ上で完結します。</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 relative mt-12">
                        <div className="hidden md:block absolute top-[45px] left-[15%] right-[15%] h-0.5 bg-slate-800 z-0 border-b border-dashed border-slate-700"></div>
                        {/* Step 1 */}
                        <div className="relative z-10 flex flex-col justify-start text-center p-6">
                            <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-800 border-2 border-blue-500/30 flex items-center justify-center mb-8 shadow-xl shadow-blue-500/10 rotate-3 hover:rotate-0 transition-transform">
                                <Upload className="w-8 h-8 text-blue-400" />
                            </div>
                            <div className="text-blue-400 font-black text-sm uppercase tracking-widest mb-3">Step 1</div>
                            <h3 className="text-2xl font-bold text-white mb-4">図面をアップロード</h3>
                            <p className="text-slate-400 leading-relaxed text-sm">
                                PDF形式の図面をドラッグ＆ドロップ。複数ファイルの一括登録やフォルダ単位の登録にも対応しています。
                            </p>
                        </div>
                        {/* Step 2 */}
                        <div className="relative z-10 flex flex-col justify-start text-center p-6">
                            <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-800 border-2 border-cyan-500/30 flex items-center justify-center mb-8 shadow-xl shadow-cyan-500/10 -rotate-3 hover:rotate-0 transition-transform">
                                <Cpu className="w-8 h-8 text-cyan-400" />
                            </div>
                            <div className="text-cyan-400 font-black text-sm uppercase tracking-widest mb-3">Step 2</div>
                            <h3 className="text-2xl font-bold text-white mb-4">AIが自動解析</h3>
                            <p className="text-slate-400 leading-relaxed text-sm">
                                AIが図面を読み取り、品名・材質・寸法・加工内容などの情報を瞬時にデータ化し、見積金額を自動算出します。
                            </p>
                        </div>
                        {/* Step 3 */}
                        <div className="relative z-10 flex flex-col justify-start text-center p-6">
                            <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-800 border-2 border-emerald-500/30 flex items-center justify-center mb-8 shadow-xl shadow-emerald-500/10 rotate-3 hover:rotate-0 transition-transform">
                                <CalendarDays className="w-8 h-8 text-emerald-400" />
                            </div>
                            <div className="text-emerald-400 font-black text-sm uppercase tracking-widest mb-3">Step 3</div>
                            <h3 className="text-2xl font-bold text-white mb-4">見積書発行＆工程管理へ</h3>
                            <p className="text-slate-400 leading-relaxed text-sm">
                                美しい見積書（PDF）をワンクリックで出力。受注した案件はシームレスにガントチャートに移行し進捗管理が始まります。
                            </p>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section className="max-w-7xl mx-auto px-4 md:px-8 py-20">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-4">AiZumenの3つの強み</h2>
                        <p className="text-slate-400">属人的な見積もり業務を標準化し、圧倒的な効率化を実現します。</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="p-8 rounded-3xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/60 transition-colors group">
                            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Brain className="w-7 h-7 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">AI図面自動抽出</h3>
                            <p className="text-slate-400 leading-relaxed">
                                アップロードしたPDF図面から、加工内容、主要寸法、表面処理指定などを即座に読み取りデータ化。見落としを防ぎます。
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="p-8 rounded-3xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/60 transition-colors group">
                            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <FileText className="w-7 h-7 text-cyan-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">見積書・帳票の自動生成</h3>
                            <p className="text-slate-400 leading-relaxed">
                                抽出されたデータをもとに、加工費や材料費を自動計算。美しいPDF見積書をワンクリックで生成し顧客へ提出可能です。
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="p-8 rounded-3xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/60 transition-colors group">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <CalendarDays className="w-7 h-7 text-emerald-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">ガントチャート連携</h3>
                            <p className="text-slate-400 leading-relaxed">
                                受注した案件は自動で生産スケジューラに追加。納期と工程のビジュアル管理が可能になり、進捗確認がスムーズに。
                            </p>
                        </div>
                    </div>
                </section>

                {/* Social Proof / Security */}
                <section className="max-w-7xl mx-auto px-4 md:px-8 py-20 border-t border-white/5 text-center">
                    <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-800/80 border border-slate-700 shadow-lg">
                        <Shield className="w-5 h-5 text-indigo-400" />
                        <span className="text-sm font-bold text-slate-300">エンタープライズ基準のセキュリティでデータを保護</span>
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
                                <li className="flex items-start gap-3 text-sm text-slate-300 font-medium"><Check className="w-5 h-5 text-emerald-400 shrink-0" /> AI抽出条件のカスタム可能</li>
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
                                <li className="flex items-start gap-3 text-sm text-white font-medium"><Check className="w-5 h-5 text-cyan-400 shrink-0" /> AI抽出条件のカスタム可能</li>
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
                                <li className="flex items-start gap-3 text-sm text-slate-300 font-medium"><Check className="w-5 h-5 text-emerald-400 shrink-0" /> 最大50ユーザー利用可能</li>
                                <li className="flex items-start gap-3 text-sm text-slate-300 font-medium"><Check className="w-5 h-5 text-emerald-400 shrink-0" /> 毎月1,000 AIクレジット付与</li>
                                <li className="flex items-start gap-3 text-sm text-slate-300 font-medium"><Check className="w-5 h-5 text-emerald-400 shrink-0" /> フル機能・高度な分析レポート</li>
                            </ul>
                            <Link to="/signup" className="w-full py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-center transition-all border border-white/5">無料で試す</Link>
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
