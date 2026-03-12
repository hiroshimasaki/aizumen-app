require('dotenv').config();
const Stripe = require('stripe');

const STRIPE_SECRET_KEY = process.env.PROD_STRIPE_SECRET_KEY;
const stripe = new Stripe(STRIPE_SECRET_KEY);

async function dumpSub(customerId) {
    try {
        const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            expand: ['data.plan.product']
        });
        console.log(JSON.stringify(subscriptions, null, 2));
    } catch (err) {
        console.error(err.message);
    }
}

dumpSub('cus_U6s2Was3NAb2fH');
