const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixInventoryRLS() {
  try {
    console.log('🔧 Re-enabling inventory_products RLS with proper user isolation...\n');
    
    // Re-enable RLS
    console.log('📝 Re-enabling RLS...');
    await pool.query('ALTER TABLE inventory_products ENABLE ROW LEVEL SECURITY');
    console.log('✅ RLS enabled');
    
    // Drop any existing policies
    console.log('\n🗑️  Dropping existing policies...');
    await pool.query('DROP POLICY IF EXISTS "Public can view inventory products" ON inventory_products');
    await pool.query('DROP POLICY IF EXISTS "Public can insert inventory products" ON inventory_products');
    await pool.query('DROP POLICY IF EXISTS "Public can update inventory products" ON inventory_products');
    await pool.query('DROP POLICY IF EXISTS "Public can delete inventory products" ON inventory_products');
    console.log('✅ Dropped existing policies');
    
    // Create new policies with proper user_id checks
    console.log('\n📝 Creating new user-isolated policies...');
    
    // Allow authenticated users to view only their own products
    await pool.query(`
      CREATE POLICY "Users can view own inventory_products"
      ON inventory_products FOR SELECT
      TO authenticated
      USING (auth.uid()::text = user_id);
    `);
    console.log('✅ Created SELECT policy with user_id check');
    
    // Allow authenticated users to insert only their own products
    await pool.query(`
      CREATE POLICY "Users can insert own inventory_products"
      ON inventory_products FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid()::text = user_id);
    `);
    console.log('✅ Created INSERT policy with user_id check');
    
    // Allow authenticated users to update only their own products
    await pool.query(`
      CREATE POLICY "Users can update own inventory_products"
      ON inventory_products FOR UPDATE
      TO authenticated
      USING (auth.uid()::text = user_id)
      WITH CHECK (auth.uid()::text = user_id);
    `);
    console.log('✅ Created UPDATE policy with user_id check');
    
    // Allow authenticated users to delete only their own products
    await pool.query(`
      CREATE POLICY "Users can delete own inventory_products"
      ON inventory_products FOR DELETE
      TO authenticated
      USING (auth.uid()::text = user_id);
    `);
    console.log('✅ Created DELETE policy with user_id check');
    
    console.log('\n✅ All inventory_products policies created with proper user isolation');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
fixInventoryRLS();
