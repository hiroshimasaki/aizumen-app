import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * 特定商取引法に基づく表記ページ
 */
export default function CommercialTransaction() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-300">
            <div className="max-w-3xl mx-auto px-4 py-16">
                <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition-colors">
                    <ArrowLeft size={16} /> トップページに戻る
                </Link>

                <h1 className="text-3xl font-black text-white mb-2">特定商取引法に基づく表記</h1>
                <p className="text-sm text-slate-500 mb-12">最終更新日: 2026年3月4日</p>

                <div className="prose prose-invert prose-sm max-w-none">
                    <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-900/40">
                        <table className="w-full text-left border-collapse">
                            <tbody className="divide-y divide-white/5">
                                <tr>
                                    <td className="p-5 font-bold text-white w-1/3 align-top">販売業者</td>
                                    <td className="p-5">正木鉄工株式会社</td>
                                </tr>
                                <tr>
                                    <td className="p-5 font-bold text-white align-top">代表者</td>
                                    <td className="p-5"><span className="text-amber-400">【要確認：代表者名を記入】</span></td>
                                </tr>
                                <tr>
                                    <td className="p-5 font-bold text-white align-top">所在地</td>
                                    <td className="p-5"><span className="text-amber-400">【要確認：所在地を記入】</span></td>
                                </tr>
                                <tr>
                                    <td className="p-5 font-bold text-white align-top">電話番号</td>
                                    <td className="p-5"><span className="text-amber-400">【要確認：電話番号を記入】</span></td>
                                </tr>
                                <tr>
                                    <td className="p-5 font-bold text-white align-top">メールアドレス</td>
                                    <td className="p-5"><span className="text-amber-400">【要確認：メールアドレスを記入】</span></td>
                                </tr>
                                <tr>
                                    <td className="p-5 font-bold text-white align-top">サービス名</td>
                                    <td className="p-5">AiZumen（クラウド型業務支援サービス）</td>
                                </tr>
                                <tr>
                                    <td className="p-5 font-bold text-white align-top">サービスURL</td>
                                    <td className="p-5"><span className="text-amber-400">【要確認：本番URLを記入】</span></td>
                                </tr>
                                <tr>
                                    <td className="p-5 font-bold text-white align-top">販売価格</td>
                                    <td className="p-5">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li>Lite プラン: 月額 ¥10,000（税込）</li>
                                            <li>Plus プラン: 月額 ¥30,000（税込）</li>
                                            <li>Pro プラン: 月額 ¥50,000（税込）</li>
                                            <li>AIクレジット追加購入: 100クレジット ¥1,000（税込）</li>
                                        </ul>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-5 font-bold text-white align-top">販売価格以外の必要料金</td>
                                    <td className="p-5">インターネット接続料金、通信費等はお客様のご負担となります。</td>
                                </tr>
                                <tr>
                                    <td className="p-5 font-bold text-white align-top">支払方法</td>
                                    <td className="p-5">クレジットカード（Visa, Mastercard, JCB, American Express）<br />※Stripe社の決済基盤を使用</td>
                                </tr>
                                <tr>
                                    <td className="p-5 font-bold text-white align-top">支払時期</td>
                                    <td className="p-5">サブスクリプション契約時および毎月の自動更新時にカードへ請求されます。</td>
                                </tr>
                                <tr>
                                    <td className="p-5 font-bold text-white align-top">サービス提供時期</td>
                                    <td className="p-5">アカウント登録完了後、直ちにご利用いただけます。<br />新規登録時は7日間の無料トライアル期間が含まれます。</td>
                                </tr>
                                <tr>
                                    <td className="p-5 font-bold text-white align-top">返品・キャンセル</td>
                                    <td className="p-5">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li>デジタルサービスの性質上、サービス提供後の返品・返金には応じかねます。</li>
                                            <li>サブスクリプションはいつでも解約可能です。解約後も契約期間終了日までサービスをご利用いただけます。</li>
                                            <li>ダウングレードは次回更新日に反映されます。</li>
                                        </ul>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-5 font-bold text-white align-top">動作環境</td>
                                    <td className="p-5">
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li>Google Chrome、Microsoft Edge、Safari（最新バージョン推奨）</li>
                                            <li>インターネット接続環境が必要です</li>
                                        </ul>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
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
