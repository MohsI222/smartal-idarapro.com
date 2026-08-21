const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function implementUserIsolation() {
  try {
    console.log('🔧 Implementing proper user-based data isolation...\n');
    
    // Drop existing policies
    console.log('🗑️  Dropping existing policies from inventory_products...');
    await pool.query('DROP POLICY IF EXISTS "Users can view inventory_products with user_id" ON inventory_products');
    await pool.query('DROP POLICY IF EXISTS "Users can insert inventory_products with user_id" ON inventory_products');
    await pool.query('DROP POLICY IF EXISTS "Users can update inventory_products" ON inventory_products');
    await pool.query('DROP POLICY IF EXISTS "Users can delete inventory_products" ON inventory_products');
    console.log('✅ Dropped inventory_products policies');
    
    console.log('\n🗑️  Dropping existing policies from shift_reports...');
    await pool.query('DROP POLICY IF EXISTS "Users can view shift_reports with user_id" ON shift_reports');
    await pool.query('DROP POLICY IF EXISTS "Users can insert shift_reports with user_id" ON shift_reports');
    await pool.query('DROP POLICY IF EXISTS "Users can update shift_reports" ON shift_reports');
    await pool.query('DROP POLICY IF EXISTS "Users can delete shift_reports" ON shift_reports');
    console.log('✅ Dropped shift_reports policies');
    
    // Create policies that allow access only when user_id matches auth.uid()
    console.log('\n📝 Creating user-isolated policies for inventory_products...');
    
    await pool.query(`
      CREATE POLICY "Users can view own inventory_products"
      ON inventory_products FOR SELECT
      TO authenticated
      USING (auth.uid()::text = user_id);
    `);
    console.log('✅ Created SELECT policy (auth.uid() = user_id)');
    
    await pool.query(`
      CREATE POLICY "Users can insert own inventory_products"
      ON inventory_products FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid()::text = user_id);
    `);
    console.log('✅ Created INSERT policy (auth.uid() = user_id)');
    
    await pool.query(`
      CREATE POLICY "Users can update own inventory_products"
      ON inventory_products FOR UPDATE
      TO authenticated
      USING (auth.uid()::text = user_id)
      WITH CHECK (auth.uid()::text = user_id);
    `);
    console.log('✅ Created UPDATE policy (auth.uid() = user_id)');
    
    await pool.query(`
      CREATE POLICY "Users can delete own inventory_products"
      ON inventory_products FOR DELETE
      TO authenticated
      USING (auth.uid()::text = user_id);
    `);
    console.log('✅ Created DELETE policy (auth.uid() = user_id)');
    
    // Do the same for shift_reports
    console.log('\n📝 Creating user-isolated policies for shift_reports...');
    
    await pool.query(`
      CREATE POLICY "Users can view own shift_reports"
      ON shift_reports FOR SELECT
      TO authenticated
      USING (auth.uid()::text = user_id);
    `);
    console.log('✅ Created SELECT policy (auth.uid() = user_id)');
    
    await pool.query(`
      CREATE POLICY "Users can insert own shift_reports"
      ON shift_reports FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid()::text = user_id);
    `);
    console.log('✅ Created INSERT policy (auth.uid() = user_id)');
    
    await pool.query(`
      CREATE POLICY "Users can update own shift_reports"
      ON shift_reports FOR UPDATE
      TO authenticated
      USING (auth.uid()::text = user_id)
      WITH CHECK (auth.uid()::text = user_id);
    `);
    console.log('✅ Created UPDATE policy (auth.uid() = user_id)');
    
    await pool.query(`
      CREATE POLICY "Users can delete own shift_reports"
      ON shift_reports FOR DELETE
      TO authenticated
      USING (auth.uid()::text = user_id);
    `);
    console.log('✅ Created DELETE policy (auth.uid() = user_id)');
    
    console.log('\n✅ Proper user-based isolation implemented');
    console.log('⚠️  Note: Frontend must use authenticated Supabase client for this to work');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
implementUserIsolation();
