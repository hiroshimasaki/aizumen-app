import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * データ保護方針（秘密保持に関する方針）ページ
 */
export default function DataProtectionPolicy() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-300">
            <div className="max-w-3xl mx-auto px-4 py-16">
                <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition-colors">
                    <ArrowLeft size={16} /> トップページに戻る
                </Link>

                <h1 className="text-3xl font-black text-white mb-2">データ保護・秘密保持方針</h1>
                <p className="text-sm text-slate-500 mb-12">最終更新日: 2026年3月4日</p>

                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-6 mb-12">
                    <p className="text-sm text-indigo-200 leading-relaxed">
                        AiZumenは、製造業のお客様が扱う図面・注文書等の機密性の高いデータを取り扱います。当社は、お預かりするすべてのデータを厳格に管理し、お客様のビジネスの安全を最優先に考えています。
                    </p>
                </div>

                <div className="prose prose-invert prose-sm max-w-none space-y-8">

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">1. 基本方針</h2>
                        <p>当社は、お客様からお預かりした一切のデータ（注文書、図面、取引先情報、金額情報等）を、厳重な秘密情報として取り扱います。当社の従業員および業務委託先に対しても、秘密保持義務を課しています。</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">2. AIによるデータ処理と学習不使用の保証</h2>
                        <p>本サービスで使用するAI（Google Gemini API）について、以下を保証します。</p>
                        <div className="mt-4 space-y-4">
                            <div className="bg-slate-900/50 p-5 rounded-xl border border-white/5">
                                <h3 className="text-sm font-bold text-emerald-400 mb-2">✅ 学習データに使用しません</h3>
                                <p className="text-sm">お客様がアップロードした図面・注文書は、いかなる場合もAIのモデル学習（トレーニング）のためのデータとして使用されません。</p>
                            </div>
                            <div className="bg-slate-900/50 p-5 rounded-xl border border-white/5">
                                <h3 className="text-sm font-bold text-emerald-400 mb-2">✅ 処理後にデータは破棄されます</h3>
                                <p className="text-sm">AI解析のためにAPIに送信されたデータは、処理完了後にAPI側で自動的に破棄されます。当社以外がデータを保持・再利用することはありません。</p>
                            </div>
                            <div className="bg-slate-900/50 p-5 rounded-xl border border-white/5">
                                <h3 className="text-sm font-bold text-emerald-400 mb-2">✅ エンタープライズ設定を採用</h3>
                                <p className="text-sm">Google Cloud のエンタープライズ向け利用規約に基づきAPIを利用しており、契約レベルでデータの非学習利用が保証されています。</p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">3. データの保管場所とセキュリティ</h2>
                        <div className="mt-4 space-y-4">
                            <div className="bg-slate-900/50 p-5 rounded-xl border border-white/5">
                                <h3 className="text-sm font-bold text-blue-400 mb-2">🏢 国内リージョンでの保管</h3>
                                <p className="text-sm">すべてのデータは、Supabase / AWS の<strong>日本国内リージョン（東京）</strong>に保管されます。海外のサーバーにデータが送信されることはありません（AIのAPI呼び出しを除く）。</p>
                            </div>
                            <div className="bg-slate-900/50 p-5 rounded-xl border border-white/5">
                                <h3 className="text-sm font-bold text-blue-400 mb-2">🔒 SSL/TLSによる暗号化通信</h3>
                                <p className="text-sm">すべての通信は、SSL/TLSプロトコルにより暗号化されています。第三者によるデータの傍受は技術的に不可能です。</p>
                            </div>
                            <div className="bg-slate-900/50 p-5 rounded-xl border border-white/5">
                                <h3 className="text-sm font-bold text-blue-400 mb-2">🛡️ テナント間データ分離</h3>
                                <p className="text-sm">データベースレベルで厳格なアクセス制御（Row Level Security）を実施しており、他のテナント（他社）のデータが閲覧・取得されることは技術的にありません。</p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">4. データへのアクセス制御</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>お客様のデータにアクセスできるのは、システム運用に必要な最小限の当社担当者のみです。</li>
                            <li>すべてのアクセスは認証とロール管理（一般ユーザー、管理者、システム管理者）により制御されています。</li>
                            <li>管理者によるユーザーのパスワード閲覧は不可能です（ハッシュ化して保存）。</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">5. インシデント対応</h2>
                        <p>万が一、データ漏洩等のセキュリティインシデントが発生した場合は、速やかに以下の対応を行います。</p>
                        <ol className="list-decimal pl-5 space-y-2 mt-2">
                            <li>被害の拡大防止措置</li>
                            <li>影響を受けるお客様への速やかな通知</li>
                            <li>原因の調査および再発防止策の実施</li>
                            <li>必要に応じて関係機関への報告</li>
                        </ol>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">6. データの削除</h2>
                        <p>お客様がサービスの利用を終了された場合、ご要望に応じてすべてのデータ（アカウント情報、アップロードファイル、解析結果等）を完全に削除いたします。削除完了後、当社がデータを復元する手段はありません。</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">7. お問い合わせ</h2>
                        <p>データの取り扱いに関するご質問・ご相談は、以下までお問い合わせください。</p>
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 mt-4">
                            <p>正木鉄工株式会社</p>
                            <p>Email: <span className="text-amber-400">【要確認：メールアドレスを記入】</span></p>
                        </div>
                    </section>

                </div>

                <div className="mt-16 pt-8 border-t border-white/10 text-center">
                    <Link to="/" className="text-sm text-slate-400 hover:text-white transition-colors">
                        ← トップページに戻る
                    </Link>
                </div>
            </div>
        </div>
    );
}
