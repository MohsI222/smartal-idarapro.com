const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixUserIds() {
  try {
    console.log('🔧 Fixing user IDs in inventory_products...\n');
    
    // Get a valid auth user ID (use the first one)
    const authUsers = await pool.query('SELECT id, email FROM auth.users LIMIT 1');
    if (authUsers.rows.length === 0) {
      console.log('❌ No auth users found');
      return;
    }
    
    const validUserId = authUsers.rows[0].id;
    const validEmail = authUsers.rows[0].email;
    console.log(`👤 Using valid auth user: ${validEmail} (${validUserId})`);
    
    // Update all inventory_products to use this valid user ID
    const updateResult = await pool.query('UPDATE inventory_products SET user_id = $1', [validUserId]);
    console.log(`✅ Updated ${updateResult.rowCount} products to valid user ID`);
    
    // Verify the update
    const verifyResult = await pool.query('SELECT COUNT(*) as count FROM inventory_products WHERE user_id = $1', [validUserId]);
    console.log(`📊 Products with valid user ID: ${verifyResult.rows[0].count}`);
    
    // Show sample products
    const sampleResult = await pool.query('SELECT name, user_id FROM inventory_products WHERE user_id = $1 LIMIT 5', [validUserId]);
    console.log('\n📋 Sample products:');
    sampleResult.rows.forEach((p, i) => {
      console.log(`${i + 1}. "${p.name}" (User ID: ${p.user_id})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
fixUserIds();
