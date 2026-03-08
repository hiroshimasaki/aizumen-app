const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

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
        console.log(`\n--- Processing factor: ${factor.friendly_name} (${factor.id}) ---`);
        
        const userId = targetUser.id;
        const factorId = factor.id;

        console.log(`Attempting delete via direct REST API (fetch)...`);
        
        try {
            // SDK の UUID バリデーションバグをバイパスするため、直接 GoTrue API を叩く
            const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${userId}/factors/${factorId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
                    'Content-Type': 'application/json'
                }
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error(`Delete failed: Status=${res.status}, Message=${errorText}`);
            } else {
                console.log(`Successfully deleted factors for user ${userId} via REST API.`);
            }
        } catch (e) {
            console.error(`Threw error:`, e.message);
        }
    }

    console.log('\n--- Status ---');
    console.log('MFA Reset Complete. Please logout from the app and login again to see the QR code.');
}

// 実行（引数のメールアドレスから [] などを取り除く）
const rawEmail = process.argv[2] || 'test@example.com';
const email = rawEmail.replace(/[\[\]]/g, '');

resetMFA(email).catch(console.error);
