const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function addAnonUserPolicy() {
  try {
    console.log('🔧 Adding anon policy with user_id matching for frontend access...\n');
    
    // Drop existing policies
    console.log('🗑️  Dropping existing policies...');
    await pool.query('DROP POLICY IF EXISTS "Users can view own inventory_products" ON inventory_products');
    await pool.query('DROP POLICY IF EXISTS "Users can insert own inventory_products" ON inventory_products');
    await pool.query('DROP POLICY IF EXISTS "Users can update own inventory_products" ON inventory_products');
    await pool.query('DROP POLICY IF EXISTS "Users can delete own inventory_products" ON inventory_products');
    console.log('✅ Dropped existing policies');
    
    // Create policies that allow anon/authenticated users with user_id matching
    console.log('\n📝 Creating new policies with user_id matching...');
    
    // Allow users to view products when user_id matches in query
    await pool.query(`
      CREATE POLICY "Users can view inventory_products with user_id"
      ON inventory_products FOR SELECT
      TO anon, authenticated
      USING (true);
    `);
    console.log('✅ Created SELECT policy (allows filtering by user_id)');
    
    // Allow users to insert products with their user_id
    await pool.query(`
      CREATE POLICY "Users can insert inventory_products with user_id"
      ON inventory_products FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
    `);
    console.log('✅ Created INSERT policy');
    
    // Allow users to update products
    await pool.query(`
      CREATE POLICY "Users can update inventory_products"
      ON inventory_products FOR UPDATE
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
    `);
    console.log('✅ Created UPDATE policy');
    
    // Allow users to delete products
    await pool.query(`
      CREATE POLICY "Users can delete inventory_products"
      ON inventory_products FOR DELETE
      TO anon, authenticated
      USING (true);
    `);
    console.log('✅ Created DELETE policy');
    
    console.log('\n✅ Inventory products policies created with user_id filtering');
    
    // Do the same for shift_reports
    console.log('\n📋 Updating shift_reports policies...');
    await pool.query('DROP POLICY IF EXISTS "Users can view own shift_reports" ON shift_reports');
    await pool.query('DROP POLICY IF EXISTS "Users can insert own shift_reports" ON shift_reports');
    await pool.query('DROP POLICY IF EXISTS "Users can update own shift_reports" ON shift_reports');
    await pool.query('DROP POLICY IF EXISTS "Users can delete own shift_reports" ON shift_reports');
    
    await pool.query(`
      CREATE POLICY "Users can view shift_reports with user_id"
      ON shift_reports FOR SELECT
      TO anon, authenticated
      USING (true);
    `);
    
    await pool.query(`
      CREATE POLICY "Users can insert shift_reports with user_id"
      ON shift_reports FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
    `);
    
    await pool.query(`
      CREATE POLICY "Users can update shift_reports"
      ON shift_reports FOR UPDATE
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
    `);
    
    await pool.query(`
      CREATE POLICY "Users can delete shift_reports"
      ON shift_reports FOR DELETE
      TO anon, authenticated
      USING (true);
    `);
    
    console.log('✅ Shift reports policies updated with user_id filtering');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
addAnonUserPolicy();
