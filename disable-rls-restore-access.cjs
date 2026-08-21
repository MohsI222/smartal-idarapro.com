const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function disableRLSRestoreAccess() {
  try {
    console.log('🔧 Disabling RLS to restore access (as it was before)...\n');
    
    // Disable RLS for inventory_products
    console.log('📦 Disabling RLS for inventory_products...');
    await pool.query('ALTER TABLE inventory_products DISABLE ROW LEVEL SECURITY');
    console.log('✅ RLS disabled for inventory_products');
    
    // Disable RLS for shift_reports
    console.log('\n📋 Disabling RLS for shift_reports...');
    await pool.query('ALTER TABLE shift_reports DISABLE ROW LEVEL SECURITY');
    console.log('✅ RLS disabled for shift_reports');
    
    // Grant full permissions to anon and authenticated
    console.log('\n📝 Granting full permissions...');
    await pool.query('GRANT ALL ON inventory_products TO anon');
    await pool.query('GRANT ALL ON inventory_products TO authenticated');
    await pool.query('GRANT ALL ON shift_reports TO anon');
    await pool.query('GRANT ALL ON shift_reports TO authenticated');
    console.log('✅ Full permissions granted');
    
    // Verify the changes
    console.log('\n🔍 Verifying changes...');
    const invRls = await pool.query('SELECT relname, relrowsecurity FROM pg_class WHERE relname = \'inventory_products\'');
    const shiftRls = await pool.query('SELECT relname, relrowsecurity FROM pg_class WHERE relname = \'shift_reports\'');
    
    console.log(`📦 inventory_products RLS: ${invRls.rows[0].relrowsecurity ? 'ENABLED' : 'DISABLED'}`);
    console.log(`📋 shift_reports RLS: ${shiftRls.rows[0].relrowsecurity ? 'ENABLED' : 'DISABLED'}`);
    
    // Test access
    console.log('\n🧪 Testing access...');
    const invCount = await pool.query('SELECT COUNT(*) as count FROM inventory_products');
    const shiftCount = await pool.query('SELECT COUNT(*) as count FROM shift_reports');
    
    console.log(`✅ Total inventory products: ${invCount.rows[0].count}`);
    console.log(`✅ Total shift reports: ${shiftCount.rows[0].count}`);
    
    console.log('\n✅ RLS disabled and access restored (as it was before)');
    console.log('⚠️  Note: Data protection will be implemented at application level');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
disableRLSRestoreAccess();
