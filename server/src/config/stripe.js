const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('[Stripe] Warning: STRIPE_SECRET_KEY not set');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-01-27.acacia',
});

// プラン設定
const PLAN_CONFIG = {
    free: {
        name: 'Free Trial',
        maxUsers: 1,
        monthlyCredits: 10,
        maxStorageGB: 1,      // 追加
        priceId: null,       // Stripeは使わない
        amount: 0,
        trialDays: 7,        // 7日間の無料トライアル
    },
    lite: {
        name: 'Lite',
        maxUsers: 2,
        monthlyCredits: 100,
        maxStorageGB: 5,      // 追加
        priceId: process.env.STRIPE_PRICE_LITE,
        amount: 10000,
    },
    plus: {
        name: 'Plus',
        maxUsers: 10,
        monthlyCredits: 500,
        maxStorageGB: 20,     // 追加
        priceId: process.env.STRIPE_PRICE_PLUS,
        amount: 30000,
    },
    pro: {
        name: 'Pro',
        maxUsers: 50, // 20 -> 50 に引き上げ
        monthlyCredits: 1000,
        maxStorageGB: 100,
        priceId: process.env.STRIPE_PRICE_PRO,
        amount: 50000,
    },
};

/**
 * プラン設定を大文字小文字を区別せずに取得するヘルパー
 */
const getPlanConfig = (planKey) => {
    if (!planKey) return null;
    return PLAN_CONFIG[planKey.toLowerCase()] || null;
};

const CREDIT_CONFIG = {
    '200': {
        credits: 200,
        priceId: process.env.STRIPE_PRICE_CREDIT_200,
        amount: 2000,
    },
    '1200': {
        credits: 1200,
        priceId: process.env.STRIPE_PRICE_CREDIT_1200,
        amount: 10000,
    },
    '2500': {
        credits: 2500,
        priceId: process.env.STRIPE_PRICE_CREDIT_2500,
        amount: 20000,
    },
};

module.exports = { stripe, PLAN_CONFIG, CREDIT_CONFIG, getPlanConfig };
