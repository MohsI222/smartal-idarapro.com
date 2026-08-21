const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function addPublicPolicy() {
  try {
    console.log('🔧 Adding public access policy for inventory_products...\n');
    
    // Drop existing policies
    console.log('🗑️  Dropping existing policies...');
    await pool.query('DROP POLICY IF EXISTS "Users can view own inventory products" ON inventory_products');
    await pool.query('DROP POLICY IF EXISTS "Users can insert own inventory products" ON inventory_products');
    await pool.query('DROP POLICY IF EXISTS "Users can update own inventory products" ON inventory_products');
    await pool.query('DROP POLICY IF EXISTS "Users can delete own inventory products" ON inventory_products');
    console.log('✅ Dropped existing policies');
    
    // Create new policies that allow authenticated users to access all data
    console.log('\n📝 Creating new policies...');
    
    // Allow authenticated users to view all products
    await pool.query(`
      CREATE POLICY "Authenticated users can view inventory products"
      ON inventory_products FOR SELECT
      TO authenticated
      USING (true);
    `);
    console.log('✅ Created SELECT policy');
    
    // Allow authenticated users to insert products
    await pool.query(`
      CREATE POLICY "Authenticated users can insert inventory products"
      ON inventory_products FOR INSERT
      TO authenticated
      WITH CHECK (true);
    `);
    console.log('✅ Created INSERT policy');
    
    // Allow authenticated users to update products
    await pool.query(`
      CREATE POLICY "Authenticated users can update inventory products"
      ON inventory_products FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
    `);
    console.log('✅ Created UPDATE policy');
    
    // Allow authenticated users to delete products
    await pool.query(`
      CREATE POLICY "Authenticated users can delete inventory products"
      ON inventory_products FOR DELETE
      TO authenticated
      USING (true);
    `);
    console.log('✅ Created DELETE policy');
    
    console.log('\n✅ All policies created successfully');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
addPublicPolicy();
