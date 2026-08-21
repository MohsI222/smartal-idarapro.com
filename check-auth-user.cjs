const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkAuthUser() {
  try {
    console.log('🔍 Checking authentication and user mapping...\n');
    
    // Check if there are any auth users
    const authUsers = await pool.query('SELECT id, email FROM auth.users LIMIT 5');
    console.log(`👥 Auth users: ${authUsers.rows.length}`);
    authUsers.rows.forEach((u, i) => {
      console.log(`${i + 1}. ID: ${u.id}, Email: ${u.email}`);
    });
    
    // Check inventory_products with different user_ids
    const inventoryUsers = await pool.query('SELECT DISTINCT user_id FROM inventory_products');
    console.log(`\n📦 User IDs in inventory_products: ${inventoryUsers.rows.length}`);
    inventoryUsers.rows.forEach((u, i) => {
      console.log(`${i + 1}. ${u.user_id}`);
    });
    
    // Check if the test user_id matches any auth user
    const testUserId = 'c905d8d6-dcbd-4414-8214-7300ff6c7552';
    const authMatch = await pool.query('SELECT id FROM auth.users WHERE id = $1', [testUserId]);
    console.log(`\n🔍 Test user ${testUserId} exists in auth.users: ${authMatch.rows.length > 0 ? 'YES' : 'NO'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}
checkAuthUser();
