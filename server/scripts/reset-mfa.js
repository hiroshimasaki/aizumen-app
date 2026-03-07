const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetMFA(email) {
    console.log(`[Support] Resetting MFA for: ${email}`);

    // 1. User IDを取得
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) throw authError;

    const targetUser = users.find(u => u.email === email);
    if (!targetUser) {
        console.error('User not found');
        return;
    }

    console.log(`User ID: ${targetUser.id}`);

    // 2. 詳細なユーザー情報を取得して MFA Factors を確実に特定する
    const { data: { user }, error: getError } = await supabase.auth.admin.getUserById(targetUser.id);
    if (getError) throw getError;

    const factors = user.factors || [];
    console.log(`Found ${factors.length} factors in user profile.`);

    for (const factor of factors) {
        console.log(`Deleting factor: ${factor.friendly_name || factor.factor_type} (${factor.id})`);
        const { error: deleteError } = await supabase.auth.admin.mfa.deleteFactor({
            userId: targetUser.id,
            factorId: factor.id
        });
        if (deleteError) {
            console.error(`Delete failed for factor ${factor.id}:`, deleteError);
        } else {
            console.log(`Successfully deleted factor ${factor.id}`);
        }
    }

    console.log('\n--- Status ---');
    console.log('MFA Reset Complete. Please logout from the app and login again to see the QR code.');
}

// 実行（引数のメールアドレスから [] などを取り除く）
const rawEmail = process.argv[2] || 'test@example.com';
const email = rawEmail.replace(/[\[\]]/g, '');

resetMFA(email).catch(console.error);
