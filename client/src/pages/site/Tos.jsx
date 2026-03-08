import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * 利用規約ページ
 */
export default function TermsOfService() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-300">
            <div className="max-w-3xl mx-auto px-4 py-16">
                <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition-colors">
                    <ArrowLeft size={16} /> トップページに戻る
                </Link>

                <h1 className="text-3xl font-black text-white mb-2">利用規約</h1>
                <p className="text-sm text-slate-500 mb-12">最終更新日: 2026年3月4日</p>

                <div className="prose prose-invert prose-sm max-w-none space-y-8">

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">第1条（適用）</h2>
                        <p>本規約は、AiZumen（代表：正木 裕士、以下「当方」）が提供するクラウド型業務支援サービス「AiZumen」（以下「本サービス」）の利用に関する条件を定めるものです。ご利用にあたり、本規約に同意いただいたものとみなします。</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">第2条（定義）</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>「ユーザー」：本サービスの利用登録を行い、アカウントを保有する個人または法人。</li>
                            <li>「テナント」：本サービスにおいて一つの企業単位として管理されるグループ。</li>
                            <li>「コンテンツ」：ユーザーが本サービスにアップロードした図面、注文書、その他のデータ一切。</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">第3条（アカウント登録）</h2>
                        <ol className="list-decimal pl-5 space-y-2">
                            <li>本サービスの利用にはアカウント登録が必要です。</li>
                            <li>登録情報は真実かつ正確であることを保証していただきます。</li>
                            <li>アカウントの管理責任はユーザーご自身にあります。第三者による不正利用について、当方は一切責任を負いません。</li>
                        </ol>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">第4条（料金・支払い）</h2>
                        <ol className="list-decimal pl-5 space-y-2">
                            <li>本サービスの料金は、ウェブサイト上に表示されたプラン料金に従います。</li>
                            <li>支払いはStripeを通じたクレジットカード決済により行われます。</li>
                            <li>プランのアップグレードは即時反映、ダウングレードは次回更新日に反映されます。</li>
                            <li>一度支払われた料金は、法令に定める場合を除き、返金いたしません。</li>
                        </ol>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">第5条（禁止事項）</h2>
                        <p>ユーザーは以下の行為を行ってはなりません。</p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li>法令または公序良俗に違反する行為。</li>
                            <li>本サービスのサーバーまたはネットワークに不正にアクセスする行為。</li>
                            <li>本サービスの運営を妨害するおそれのある行為。</li>
                            <li>第三者の知的財産権、プライバシー、その他の権利を侵害する行為。</li>
                            <li>リバースエンジニアリング、逆コンパイル、逆アセンブルを行う行為。</li>
                            <li>本サービスを利用して第三者に対する迷惑行為や不正行為を行うこと。</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">第6条（コンテンツの取扱い）</h2>
                        <ol className="list-decimal pl-5 space-y-2">
                            <li>ユーザーがアップロードしたコンテンツの著作権等の知的財産権は、ユーザーに帰属します。</li>
                            <li>当方は、サービス提供に必要な範囲でコンテンツにアクセスすることがあります（AI解析処理を含む）。</li>
                            <li>ユーザーのコンテンツをAIの学習データとして使用することはありません。</li>
                        </ol>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">第7条（サービスの変更・停止）</h2>
                        <ol className="list-decimal pl-5 space-y-2">
                            <li>当方は、ユーザーへの事前通知なく、本サービスの内容を変更、追加、または廃止する場合があります。</li>
                            <li>システムメンテナンスや不可抗力により、サービスを一時的に停止する場合があります。</li>
                        </ol>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">第8条（免責事項）</h2>
                        <ol className="list-decimal pl-5 space-y-2">
                            <li>当方は、本サービスの正確性、完全性、有用性を保証するものではありません。</li>
                            <li>AI解析結果はあくまで参考値であり、最終的な判断はユーザーの責任において行ってください。</li>
                            <li>本サービスの利用により生じた損害について、当方の故意または重大な過失によるものを除き、責任を負いません。</li>
                        </ol>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">第9条（契約の解除）</h2>
                        <ol className="list-decimal pl-5 space-y-2">
                            <li>ユーザーは、いつでも本サービスの利用を停止し、アカウントを削除することができます。</li>
                            <li>当方は、ユーザーが本規約に違反した場合、事前の通知なくアカウントを停止または削除できるものとします。</li>
                        </ol>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">第10条（準拠法・管轄裁判所）</h2>
                        <ol className="list-decimal pl-5 space-y-2">
                            <li>本規約の解釈については、日本法を準拠法とします。</li>
                            <li>本サービスに関する紛争については、当方の所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。</li>
                        </ol>
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
