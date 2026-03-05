/**
 * システム全体の制限値設定
 * SupabaseやGeminiのプランに応じて変更してください。
 * .env からの環境変数による上書きも可能です。
 */

module.exports = {
    // Supabase関連 (無料枠のデフォルト)
    STORAGE_LIMIT_BYTES: parseInt(process.env.LIMIT_STORAGE_GB || '1') * 1024 * 1024 * 1024, // 1GB
    DATABASE_LIMIT_BYTES: parseInt(process.env.LIMIT_DATABASE_MB || '500') * 1024 * 1024,     // 500MB

    // APIレート制限関連 (推定値)
    GEMINI_RPM_LIMIT: parseInt(process.env.LIMIT_GEMINI_RPM || '15'), // 分間リクエスト数 (無料枠想定)
};
