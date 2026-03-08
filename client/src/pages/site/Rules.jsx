import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * プライバシーポリシー（個人情報保護方針）ページ
 */
export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-300">
            <div className="max-w-3xl mx-auto px-4 py-16">
                <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition-colors">
                    <ArrowLeft size={16} /> トップページに戻る
                </Link>

                <h1 className="text-3xl font-black text-white mb-2">プライバシーポリシー</h1>
                <p className="text-sm text-slate-500 mb-12">最終更新日: 2026年3月4日</p>

                <div className="prose prose-invert prose-sm max-w-none space-y-8">

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">1. はじめに</h2>
                        <p>正木 裕士（以下「当方」）は、クラウド型業務支援サービス「AiZumen」（以下「本サービス」）の提供にあたり、ユーザーの個人情報およびお預かりするデータの保護を最重要事項として位置づけています。</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">2. 収集する情報</h2>
                        <p>当社は、以下の情報を収集します。</p>
                        <h3 className="text-sm font-bold text-slate-200 mt-4 mb-2">2.1 アカウント情報</h3>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>メールアドレス、会社名、会社コード、氏名</li>
                            <li>パスワード（ハッシュ化して保存）</li>
                        </ul>
                        <h3 className="text-sm font-bold text-slate-200 mt-4 mb-2">2.2 業務データ</h3>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>注文書・図面等のアップロードファイル（PDF、画像等）</li>
                            <li>案件情報（会社名、金額、納期等）</li>
                        </ul>
                        <h3 className="text-sm font-bold text-slate-200 mt-4 mb-2">2.3 利用状況データ</h3>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>アクセスログ、操作履歴</li>
                            <li>AIクレジットの消費記録</li>
                        </ul>
                        <h3 className="text-sm font-bold text-slate-200 mt-4 mb-2">2.4 決済情報</h3>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>クレジットカード情報はStripe社が安全に管理しており、当社のサーバーには保存されません。</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">3. 情報の利用目的</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>本サービスの提供・運営・改善</li>
                            <li>ユーザーサポートへの対応</li>
                            <li>利用料金の請求処理</li>
                            <li>システムの安全性確保・不正利用の防止</li>
                            <li>重要なお知らせ、メンテナンス情報の通知</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">4. AIによるデータ処理について</h2>
                        <p>本サービスでは、注文書・図面の解析にGoogle社のGemini APIを使用しています。</p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li>解析のためにAPIに送信されたデータは、<strong>AIの学習（モデルのトレーニング）には一切使用されません</strong>。</li>
                            <li>送信されたデータはAPI処理完了後に破棄されます。</li>
                            <li>当社はGoogle Cloud のエンタープライズ向け設定を採用しており、契約上もデータの学習利用は禁止されています。</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">5. 第三者提供</h2>
                        <p>当社は、以下の場合を除き、ユーザーの個人情報を第三者に提供しません。</p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li>ユーザーの同意がある場合</li>
                            <li>法令に基づく場合（裁判所の命令等）</li>
                            <li>サービス運営に必要な業務委託先（Supabase、Stripe、Google Cloud等）への提供。ただし、必要最小限のデータかつ適切な管理の下で行います。</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">6. データの安全管理</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>すべてのデータは、日本国内のリージョン（Supabase / AWS 東京リージョン）に保管されます。</li>
                            <li>通信はすべてSSL/TLSにより暗号化されます。</li>
                            <li>保存中のデータは厳重なアクセス制御（RLS: Row Level Security）により、テナント間でデータが閲覧されることはありません。</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">7. データの保持期間</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>アカウントが有効な期間中、データは保持されます。</li>
                            <li>アカウント削除の申し出があった場合、合理的な期間内にすべてのデータを削除します。</li>
                            <li>バックアップデータは、ご契約プランに応じた保持期間（7日または30日）後に自動削除されます。</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">8. ユーザーの権利</h2>
                        <p>ユーザーは、自身の個人情報について以下の権利を有します。</p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li>開示、訂正、削除の請求</li>
                            <li>利用停止の請求</li>
                        </ul>
                        <p className="mt-2">ご請求は、下記お問い合わせ窓口までご連絡ください。</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">9. お問い合わせ窓口</h2>
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                            <p>正木 裕士</p>
                            <p>Email: <span className="text-amber-400">fj081399@gmail.com</span></p>
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
