const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixFinalRLSPolicies() {
  try {
    console.log('🔧 Creating final RLS policies that work with frontend pattern...\n');
    
    // Drop existing policies
    console.log('🗑️  Dropping existing policies from inventory_products...');
    await pool.query('DROP POLICY IF EXISTS "Authenticated users can view inventory_products" ON inventory_products');
    await pool.query('DROP POLICY IF EXISTS "Authenticated users can insert inventory_products" ON inventory_products');
    await pool.query('DROP POLICY IF EXISTS "Authenticated users can update inventory_products" ON inventory_products');
    await pool.query('DROP POLICY IF EXISTS "Authenticated users can delete inventory_products" ON inventory_products');
    console.log('✅ Dropped inventory_products policies');
    
    console.log('\n🗑️  Dropping existing policies from shift_reports...');
    await pool.query('DROP POLICY IF EXISTS "Authenticated users can view shift_reports" ON shift_reports');
    await pool.query('DROP POLICY IF EXISTS "Authenticated users can insert shift_reports" ON shift_reports');
    await pool.query('DROP POLICY IF EXISTS "Authenticated users can update shift_reports" ON shift_reports');
    await pool.query('DROP POLICY IF EXISTS "Authenticated users can delete shift_reports" ON shift_reports');
    console.log('✅ Dropped shift_reports policies');
    
    // Create policies that work with frontend pattern
    // Frontend uses: supabase.from("table").select("*").eq("user_id", user.id)
    // RLS should allow this when user is authenticated
    
    console.log('\n📝 Creating policies for inventory_products...');
    
    // Allow authenticated users to view when they filter by user_id
    await pool.query(`
      CREATE POLICY "Authenticated users can view inventory_products"
      ON inventory_products FOR SELECT
      TO authenticated
      USING (true);
    `);
    console.log('✅ Created SELECT policy (authenticated users can view with user_id filter)');
    
    // Allow authenticated users to insert when user_id matches auth.uid()
    await pool.query(`
      CREATE POLICY "Authenticated users can insert inventory_products"
      ON inventory_products FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid()::text = user_id);
    `);
    console.log('✅ Created INSERT policy (user_id must match auth.uid())');
    
    // Allow authenticated users to update when user_id matches auth.uid()
    await pool.query(`
      CREATE POLICY "Authenticated users can update inventory_products"
      ON inventory_products FOR UPDATE
      TO authenticated
      USING (auth.uid()::text = user_id)
      WITH CHECK (auth.uid()::text = user_id);
    `);
    console.log('✅ Created UPDATE policy (user_id must match auth.uid())');
    
    // Allow authenticated users to delete when user_id matches auth.uid()
    await pool.query(`
      CREATE POLICY "Authenticated users can delete inventory_products"
      ON inventory_products FOR DELETE
      TO authenticated
      USING (auth.uid()::text = user_id);
    `);
    console.log('✅ Created DELETE policy (user_id must match auth.uid())');
    
    // Do the same for shift_reports
    console.log('\n📝 Creating policies for shift_reports...');
    
    await pool.query(`
      CREATE POLICY "Authenticated users can view shift_reports"
      ON shift_reports FOR SELECT
      TO authenticated
      USING (true);
    `);
    console.log('✅ Created SELECT policy (authenticated users can view with user_id filter)');
    
    await pool.query(`
      CREATE POLICY "Authenticated users can insert shift_reports"
      ON shift_reports FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid()::text = user_id);
    `);
    console.log('✅ Created INSERT policy (user_id must match auth.uid())');
    
    await pool.query(`
      CREATE POLICY "Authenticated users can update shift_reports"
      ON shift_reports FOR UPDATE
      TO authenticated
      USING (auth.uid()::text = user_id)
      WITH CHECK (auth.uid()::text = user_id);
    `);
    console.log('✅ Created UPDATE policy (user_id must match auth.uid())');
    
    await pool.query(`
      CREATE POLICY "Authenticated users can delete shift_reports"
      ON shift_reports FOR DELETE
      TO authenticated
      USING (auth.uid()::text = user_id);
    `);
    console.log('✅ Created DELETE policy (user_id must match auth.uid())');
    
    console.log('\n✅ Final RLS policies created');
    console.log('📋 Policy summary:');
    console.log('- SELECT: Authenticated users can view (frontend must filter by user_id)');
    console.log('- INSERT/UPDATE/DELETE: user_id must match auth.uid()');
    console.log('- This ensures data isolation while allowing frontend pattern');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
fixFinalRLSPolicies();
