const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixAllUserIds() {
  try {
    console.log('🔧 Fixing all user_ids to match valid auth users...\n');
    
    // Get all valid auth user IDs
    const authUsers = await pool.query('SELECT id, email FROM auth.users');
    const validUserIds = authUsers.rows.map(u => u.id);
    console.log(`👥 Valid auth users: ${validUserIds.length}`);
    
    // Fix inventory_products
    console.log('\n📦 Fixing inventory_products user_ids...');
    const invProducts = await pool.query('SELECT id, user_id FROM inventory_products');
    let invFixed = 0;
    
    for (const product of invProducts.rows) {
      if (!validUserIds.includes(product.user_id)) {
        // Assign to the first valid user (moutaouakullahcen@gmail.com)
        const newUserId = validUserIds[0];
        await pool.query('UPDATE inventory_products SET user_id = $1 WHERE id = $2', [newUserId, product.id]);
        console.log(`✅ Updated product ${product.id} to user ${newUserId}`);
        invFixed++;
      }
    }
    console.log(`📊 Fixed ${invFixed} inventory_products`);
    
    // Fix shift_reports
    console.log('\n📋 Fixing shift_reports user_ids...');
    const shiftReports = await pool.query('SELECT id, user_id FROM shift_reports');
    let shiftFixed = 0;
    
    for (const report of shiftReports.rows) {
      if (!validUserIds.includes(report.user_id)) {
        // Assign to the first valid user
        const newUserId = validUserIds[0];
        await pool.query('UPDATE shift_reports SET user_id = $1 WHERE id = $2', [newUserId, report.id]);
        console.log(`✅ Updated report ${report.id} to user ${newUserId}`);
        shiftFixed++;
      }
    }
    console.log(`📊 Fixed ${shiftFixed} shift_reports`);
    
    // Verify the fixes
    console.log('\n🔍 Verifying fixes...');
    const invUserIds = await pool.query('SELECT DISTINCT user_id FROM inventory_products');
    console.log(`📦 Inventory user_ids: ${invUserIds.rows.length}`);
    invUserIds.rows.forEach(u => console.log(`   ${u.user_id}`));
    
    const shiftUserIds = await pool.query('SELECT DISTINCT user_id FROM shift_reports');
    console.log(`📋 Shift reports user_ids: ${shiftUserIds.rows.length}`);
    shiftUserIds.rows.forEach(u => console.log(`   ${u.user_id}`));
    
    console.log('\n✅ All user_ids fixed to valid auth users');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
fixAllUserIds();
