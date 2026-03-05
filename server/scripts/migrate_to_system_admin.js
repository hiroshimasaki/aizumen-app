require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrate() {
    console.log('Starting migration: admin -> system_admin');

    // 1. usersテーブルからすべてのadminを取得
    const { data: admins, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('role', 'admin');

    if (fetchError) {
        console.error('Error fetching admins:', fetchError);
        process.exit(1);
    }

    console.log(`Found ${admins.length} admins. Updating to system_admin...`);

    for (const admin of admins) {
        console.log(`Updating user: ${admin.id} (${admin.name})`);

        // 2. users テーブルの更新
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ role: 'system_admin' })
            .eq('id', admin.id);

        if (updateError) {
            console.error(`Failed to update users table for ${admin.id}:`, updateError);
            continue;
        }

        // 3. auth.users の app_metadata を更新
        const { data: authUser, error: authGetError } = await supabaseAdmin.auth.admin.getUserById(admin.id);
        if (authGetError) {
            console.error(`Failed to get auth user for ${admin.id}:`, authGetError);
            continue;
        }

        const newMetadata = { ...authUser.user.app_metadata, role: 'system_admin' };

        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(admin.id, {
            app_metadata: newMetadata,
        });

        if (authUpdateError) {
            console.error(`Failed to update auth metadata for ${admin.id}:`, authUpdateError);
        } else {
            console.log(`Successfully updated ${admin.id}`);
        }
    }

    console.log('Migration complete.');
}

migrate().catch(console.error);
