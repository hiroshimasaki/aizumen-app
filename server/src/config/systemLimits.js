/**
 * システム全体の制限値設定
 * SupabaseやGeminiのプランに応じて変更してください。
 * .env からの環境変数による上書きも可能です。
 */

module.exports = {
    // Supabase Proプランの制限値
    STORAGE_LIMIT_BYTES: parseInt(process.env.LIMIT_STORAGE_GB || '100') * 1024 * 1024 * 1024, // 100GB
    DATABASE_LIMIT_BYTES: parseInt(process.env.LIMIT_DATABASE_GB || '8') * 1024 * 1024 * 1024,   // 8GB

    // AI解析の最適化設定 (精度と容量のバランス調整)
    MAX_TILES_PER_DRAWING: parseInt(process.env.MAX_TILES || '300'),
    DEFAULT_TILE_STRIDE: parseInt(process.env.TILE_STRIDE || '150'),

    // APIレート制限関連 (推定値)
    GEMINI_RPM_LIMIT: parseInt(process.env.LIMIT_GEMINI_RPM || '15'), // 分間リクエスト数 (無料枠想定)
};
