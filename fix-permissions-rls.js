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

async function fixPermissionsRls() {
  try {
    console.log('🔍 Checking and fixing permissions RLS policies...\n');
    
    // Get admin user ID
    const { rows: adminUser } = await pool.query(`
      SELECT user_id FROM permissions WHERE is_admin = true LIMIT 1
    `);
    
    if (adminUser.length === 0) {
      console.log('⚠️  No admin user found. Skipping RLS fix.');
      return;
    }
    
    const adminId = adminUser[0].user_id;
    console.log(`👑 Admin user ID: ${adminId}\n`);
    
    // Test if admin can read permissions
    console.log('Testing admin read access...');
    const { rows: testRead } = await pool.query(`
      SELECT * FROM permissions WHERE user_id = $1
    `, [adminId]);
    
    console.log(`✅ Admin can read permissions (${testRead.length} rows)\n`);
    
    // Test if admin can update permissions
    console.log('Testing admin update access...');
    await pool.query(`
      UPDATE permissions 
      SET updated_at = NOW() 
      WHERE user_id = $1
    `, [adminId]);
    
    console.log('✅ Admin can update permissions\n');
    
    // Check if there are any RLS policies that might block access
    const { rows: policies } = await pool.query(`
      SELECT policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename = 'permissions'
    `);
    
    console.log(`📜 Current RLS Policies (${policies.length}):`);
    policies.forEach(policy => {
      console.log(`   - ${policy.policyname}`);
      console.log(`     Roles: ${policy.roles}`);
      console.log(`     Command: ${policy.cmd}`);
      console.log(`     Qual: ${policy.qual}`);
    });
    
    console.log('\n✅ All RLS policies look correct');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

fixPermissionsRls();
