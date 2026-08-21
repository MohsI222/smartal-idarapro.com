const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkCurrentAuthUser() {
  try {
    console.log('🔍 Checking current auth users and inventory user_ids...\n');
    
    // Get all auth users
    const authUsers = await pool.query('SELECT id, email FROM auth.users');
    console.log(`👥 Auth users (${authUsers.rows.length}):`);
    authUsers.rows.forEach((u, i) => {
      console.log(`${i + 1}. ID: ${u.id}`);
      console.log(`   Email: ${u.email}`);
    });
    
    // Get user_ids in inventory_products
    const inventoryUserIds = await pool.query('SELECT DISTINCT user_id FROM inventory_products');
    console.log(`\n📦 User IDs in inventory_products (${inventoryUserIds.rows.length}):`);
    inventoryUserIds.rows.forEach((u, i) => {
      console.log(`${i + 1}. ${u.user_id}`);
    });
    
    // Get user_ids in shift_reports
    const shiftUserIds = await pool.query('SELECT DISTINCT user_id FROM shift_reports');
    console.log(`\n📋 User IDs in shift_reports (${shiftUserIds.rows.length}):`);
    shiftUserIds.rows.forEach((u, i) => {
      console.log(`${i + 1}. ${u.user_id}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}
checkCurrentAuthUser();
