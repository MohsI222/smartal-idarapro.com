import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function setupAllUsersPermissions() {
  try {
    console.log('🔧 Setting up permissions for all users...\n');
    
    // Get all auth users
    const { rows: authUsers } = await pool.query(`
      SELECT id, email, raw_user_meta_data->>'name' as name
      FROM auth.users
      WHERE deleted_at IS NULL
      ORDER BY created_at ASC
    `);
    
    console.log(`👤 Found ${authUsers.length} users\n`);
    
    // Get existing permissions
    const { rows: existingPerms } = await pool.query(`
      SELECT user_id FROM permissions
    `);
    
    const existingUserIds = existingPerms.map(p => p.user_id);
    
    for (const user of authUsers) {
      console.log(`\n📧 Processing: ${user.email}`);
      
      if (existingUserIds.includes(user.id)) {
        console.log(`   ✅ Already has permissions`);
        continue;
      }
      
      // Create permissions for this user
      await pool.query(`
        INSERT INTO permissions (
          user_id,
          can_access_inventory,
          can_access_hr,
          can_access_delivery,
          can_access_transport_logistics,
          can_access_wedding_invitations,
          can_access_legal,
          can_access_ai,
          can_access_settings,
          is_admin
        ) VALUES ($1, true, true, true, true, true, true, true, true, false)
      `, [user.id]);
      
      console.log(`   ✅ Created permissions with all sections enabled`);
    }
    
    // Update the first user as admin
    if (authUsers.length > 0) {
      const firstUser = authUsers[0];
      await pool.query(`
        UPDATE permissions 
        SET is_admin = true
        WHERE user_id = $1
      `, [firstUser.id]);
      
      console.log(`\n👑 ${firstUser.email} is now the admin`);
    }
    
    console.log('\n🎉 Setup complete!');
    console.log('All users now have permissions to access all sections.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

setupAllUsersPermissions();
