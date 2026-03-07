import React, { useState } from 'react';
import { Download, Monitor, FolderSync, Printer, ArrowRight, CheckCircle2, AlertCircle, ExternalLink, Info, MessageSquare, Zap } from 'lucide-react';

export default function HotFolderDownload() {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-indigo-500/20 rounded-[2rem] p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] -mr-16 -mt-16 rounded-full" />
                
                <div className="flex flex-col lg:flex-row gap-8 items-center relative z-10">
                    <div className="flex-1 space-y-4 text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-bold uppercase tracking-wider">
                            <Monitor size={14} />
                            Windows専用デスクトップアプリ
                        </div>
                        <h2 className="text-3xl font-black text-white leading-tight">
                            ホットフォルダで<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">帳票・注文書登録を自動化</span>
                        </h2>
                        <p className="text-slate-400 text-sm leading-relaxed max-w-lg mx-auto lg:mx-0">
                            複合機でスキャンするだけで、AiZumenが自動的に帳票・注文書を検知しAI解析を開始します。
                            ブラウザを開く手間なく、現場のワークフローにシームレスに統合できます。
                        </p>
                        <div className="flex flex-wrap gap-4 justify-center lg:justify-start pt-2">
                            <a 
                                href="#" 
                                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-black rounded-2xl hover:from-blue-500 hover:to-cyan-500 transition-all shadow-xl shadow-blue-500/20 flex items-center gap-3 active:scale-95 group"
                                onClick={(e) => {
                                    e.preventDefault();
                                    alert('現在、本番用パッケージを準備中です。完了次第ダウンロード可能になります。');
                                }}
                            >
                                <Download className="group-hover:bounce" size={20} />
                                アプリをダウンロード
                            </a>
                        </div>
                        <p className="text-[10px] text-slate-500">
                            Version 1.0.2 (Windows 10/11対応) | 最新更新: 2026-03-07
                        </p>
                    </div>

                    <div className="w-full lg:w-72 bg-slate-950/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-slate-300">
                                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400">
                                    <Printer size={16} />
                                </div>
                                <span className="text-xs font-bold">複合機と連携可</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-300">
                                <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center text-cyan-400">
                                    <Zap size={16} />
                                </div>
                                <span className="text-xs font-bold">AI自動解析</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-300">
                                <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400">
                                    <FolderSync size={16} />
                                </div>
                                <span className="text-xs font-bold">リアルタイム監視</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Workflow Guide */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-slate-800 to-transparent -translate-y-1/2 hidden md:block" />
                
                {/* Step 1 */}
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-3xl p-6 relative z-10 transition-all hover:border-blue-500/30 group">
                    <div className="w-12 h-12 bg-slate-900 border border-slate-700 rounded-2xl flex items-center justify-center mb-4 font-black text-blue-400 group-hover:scale-110 transition-transform">1</div>
                    <h3 className="text-lg font-bold text-white mb-2">スキャン</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        複合機で帳票をスキャンし、PCの「監視フォルダ」へ直接保存されるよう設定します。
                    </p>
                </div>

                {/* Step 2 */}
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-3xl p-6 relative z-10 transition-all hover:border-cyan-500/30 group">
                    <div className="w-12 h-12 bg-slate-900 border border-slate-700 rounded-2xl flex items-center justify-center mb-4 font-black text-cyan-400 group-hover:scale-110 transition-transform">2</div>
                    <h3 className="text-lg font-bold text-white mb-2">自動検知</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        ホットフォルダアプリが新規ファイルを検知し、AiZumenクラウドへ安全に転送します。
                    </p>
                </div>

                {/* Step 3 */}
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-3xl p-6 relative z-10 transition-all hover:border-indigo-500/30 group">
                    <div className="w-12 h-12 bg-slate-900 border border-slate-700 rounded-2xl flex items-center justify-center mb-4 font-black text-indigo-400 group-hover:scale-110 transition-transform">3</div>
                    <h3 className="text-lg font-bold text-white mb-2">解析完了</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        ブラウザを開くと、既にAIによる項目抽出が完了した状態で案件が表示されます。
                    </p>
                </div>
            </div>

            {/* Implementation Manual */}
            <section className="bg-slate-800/20 border border-slate-700 rounded-3xl overflow-hidden">
                <div className="p-6 border-b border-slate-700 bg-slate-800/40 flex items-center gap-2">
                    <Info className="text-blue-400" size={20} />
                    <h3 className="text-lg font-bold text-white">利用マニュアル (複合機連携)</h3>
                </div>
                
                <div className="p-8 space-y-10">
                    {/* Part 1: MFP Setup */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-black rounded uppercase tracking-wider">Step A</div>
                            <h4 className="text-base font-bold text-slate-200">複合機の「スキャン送信先」設定</h4>
                        </div>
                        <div className="ml-0 md:ml-6 space-y-4">
                            <p className="text-sm text-slate-400 leading-relaxed">
                                複合機（スキャナー）でスキャンしたデータの保存先を、PC上の「監視対象フォルダ」に指定します。
                            </p>
                            <div className="p-5 bg-slate-950/50 rounded-2xl border border-slate-800 space-y-3">
                                <ul className="space-y-3">
                                    <li className="flex gap-2 text-xs text-slate-300">
                                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                        <span>PCのデスクトップ等に `AiZumen_Watch` という空のフォルダを作成してください。</span>
                                    </li>
                                    <li className="flex gap-2 text-xs text-slate-300">
                                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                        <span>そのフォルダを「共有」設定にし、複合機の宛先（SMB送信等）として登録します。</span>
                                    </li>
                                    <li className="flex gap-2 text-xs text-slate-300">
                                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                        <span>スキャン時に **PDF** または **JPG/PNG** 形式で保存されるように設定してください。</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <ArrowRight className="mx-auto text-slate-700 rotate-90 md:rotate-0" />

                    {/* Part 2: App Setup */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-[10px] font-black rounded uppercase tracking-wider">Step B</div>
                            <h4 className="text-base font-bold text-slate-200">ホットフォルダアプリの設定</h4>
                        </div>
                        <div className="ml-0 md:ml-6 space-y-4">
                            <p className="text-sm text-slate-400 leading-relaxed">
                                ダウンロードしたアプリを起動し、監視の設定を行います。
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                                    <p className="text-xs font-bold text-blue-300">1. ログイン</p>
                                    <p className="text-[10px] text-slate-500">
                                        ブラウザと同じメールアドレスとパスワードでログインします。
                                    </p>
                                </div>
                                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                                    <p className="text-xs font-bold text-blue-300">2. フォルダ選択</p>
                                    <p className="text-[10px] text-slate-500">
                                        先ほど作成した `AiZumen_Watch` フォルダを選択します。
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Troubleshooting */}
                    <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl flex gap-3 mt-8">
                        <AlertCircle className="text-rose-500 shrink-0" size={20} />
                        <div className="text-xs text-slate-400">
                            <p className="font-bold text-rose-300 mb-1">うまくいかない場合</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Windowsのウイルス対策ソフトがアプリの実行をブロックしていないか確認してください。</li>
                                <li>インターネット接続が安定しているか確認してください。</li>
                                <li>一度に大量のファイルを投入すると、解析の待ち時間が発生する場合があります。</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Support Link */}
            <div className="text-center pb-8">
                <p className="text-sm text-slate-500 mb-4">
                    導入に関するご質問・サポートが必要な場合は、フォーラムへ。
                </p>
                <div className="inline-flex items-center gap-6">
                    <button className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 font-bold transition-all">
                        <MessageSquare size={16} />
                        よくある質問
                    </button>
                    <button className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 font-bold transition-all">
                        <ExternalLink size={16} />
                        お問い合わせ
                    </button>
                </div>
            </div>
        </div>
    );
}
