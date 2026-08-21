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

async function setupFirstAdmin() {
  try {
    console.log('🔧 Setting up first admin user...\n');
    
    // Get the first user from auth.users
    const { rows: users } = await pool.query(`
      SELECT id, email, raw_user_meta_data->>'name' as name
      FROM auth.users
      ORDER BY created_at ASC
      LIMIT 1
    `);
    
    if (users.length === 0) {
      console.log('❌ No users found in the database.');
      console.log('Please create a user first by registering in the app.');
      return;
    }
    
    const firstUser = users[0];
    console.log(`👤 Found user: ${firstUser.name || 'Unknown'} (${firstUser.email})`);
    console.log(`   User ID: ${firstUser.id}\n`);
    
    // Check if permissions already exist for this user
    const { rows: existingPerms } = await pool.query(`
      SELECT * FROM permissions WHERE user_id = $1
    `, [firstUser.id]);
    
    if (existingPerms.length > 0) {
      console.log('⚠️  Permissions already exist for this user.');
      console.log('Updating to make this user an admin...\n');
      
      await pool.query(`
        UPDATE permissions 
        SET 
          is_admin = true,
          can_access_inventory = true,
          can_access_hr = true,
          can_access_delivery = true,
          can_access_transport_logistics = true,
          can_access_wedding_invitations = true,
          can_access_legal = true,
          can_access_ai = true,
          can_access_settings = true
        WHERE user_id = $1
      `, [firstUser.id]);
      
      console.log('✅ User updated to admin with all permissions.');
    } else {
      console.log('Creating permissions for this user as admin...\n');
      
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
        ) VALUES ($1, true, true, true, true, true, true, true, true, true)
      `, [firstUser.id]);
      
      console.log('✅ User created as admin with all permissions.');
    }
    
    console.log('\n🎉 Setup complete!');
    console.log('You can now:');
    console.log('1. Log in as this user');
    console.log('2. Go to HR Module');
    console.log('3. Click on "الصلاحيات" (Permissions) tab');
    console.log('4. Manage permissions for other employees');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

setupFirstAdmin();
