const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkTablePermissions() {
  try {
    console.log('🔍 Checking table-level permissions...\n');
    
    // Check permissions for inventory_products
    const invPerms = await pool.query(`
      SELECT grantee, privilege_type 
      FROM information_schema.table_privileges 
      WHERE table_name = 'inventory_products'
    `);
    
    console.log('📦 inventory_products permissions:');
    invPerms.rows.forEach((p, i) => {
      console.log(`${i + 1}. Grantee: ${p.grantee}, Privilege: ${p.privilege_type}`);
    });
    
    // Check permissions for shift_reports
    const shiftPerms = await pool.query(`
      SELECT grantee, privilege_type 
      FROM information_schema.table_privileges 
      WHERE table_name = 'shift_reports'
    `);
    
    console.log('\n📋 shift_reports permissions:');
    shiftPerms.rows.forEach((p, i) => {
      console.log(`${i + 1}. Grantee: ${p.grantee}, Privilege: ${p.privilege_type}`);
    });
    
    // Grant permissions if missing
    console.log('\n📝 Granting permissions to anon and authenticated...');
    
    await pool.query('GRANT ALL ON inventory_products TO anon');
    await pool.query('GRANT ALL ON inventory_products TO authenticated');
    console.log('✅ Granted ALL on inventory_products');
    
    await pool.query('GRANT ALL ON shift_reports TO anon');
    await pool.query('GRANT ALL ON shift_reports TO authenticated');
    console.log('✅ Granted ALL on shift_reports');
    
    console.log('\n✅ Table permissions updated');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
checkTablePermissions();
