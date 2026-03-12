require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function checkSchema() {
    console.log('--- subscriptions ---');
    const { data: subData, error: subError } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .limit(1);
    
    if (subError) {
        console.error('Error fetching subscriptions:', subError);
    } else if (subData && subData.length > 0) {
        console.log(Object.keys(subData[0]));
    } else {
        console.log('No data in subscriptions');
    }

    console.log('--- ai_credits ---');
    const { data: creditData, error: creditError } = await supabaseAdmin
        .from('ai_credits')
        .select('*')
        .limit(1);
        
    if (creditError) {
        console.error('Error fetching ai_credits:', creditError);
    } else if (creditData && creditData.length > 0) {
        console.log(Object.keys(creditData[0]));
    } else {
        console.log('No data in ai_credits');
    }
}

checkSchema();
