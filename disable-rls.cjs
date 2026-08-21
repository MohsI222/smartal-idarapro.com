const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function disableRLS() {
  try {
    console.log('🔧 Disabling RLS for inventory_products...\n');
    
    // Disable RLS
    await pool.query('ALTER TABLE inventory_products DISABLE ROW LEVEL SECURITY');
    console.log('✅ Disabled RLS for inventory_products');
    
    // Grant table permissions to anon and authenticated
    console.log('\n📝 Granting table permissions...');
    
    await pool.query('GRANT ALL ON inventory_products TO anon');
    console.log('✅ Granted ALL to anon');
    
    await pool.query('GRANT ALL ON inventory_products TO authenticated');
    console.log('✅ Granted ALL to authenticated');
    
    console.log('\n✅ RLS disabled and permissions granted');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
disableRLS();
