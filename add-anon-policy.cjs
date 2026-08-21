const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function addAnonPolicy() {
  try {
    console.log('🔧 Adding anon (public) access policy for inventory_products...\n');
    
    // Drop existing policies
    console.log('🗑️  Dropping existing policies...');
    await pool.query('DROP POLICY IF EXISTS "Authenticated users can view inventory products" ON inventory_products');
    await pool.query('DROP POLICY IF EXISTS "Authenticated users can insert inventory products" ON inventory_products');
    await pool.query('DROP POLICY IF EXISTS "Authenticated users can update inventory products" ON inventory_products');
    await pool.query('DROP POLICY IF EXISTS "Authenticated users can delete inventory products" ON inventory_products');
    console.log('✅ Dropped existing policies');
    
    // Create new policies that allow anon (public) access
    console.log('\n📝 Creating new anon policies...');
    
    // Allow anon users to view all products
    await pool.query(`
      CREATE POLICY "Public can view inventory products"
      ON inventory_products FOR SELECT
      TO anon, authenticated
      USING (true);
    `);
    console.log('✅ Created SELECT policy');
    
    // Allow anon users to insert products
    await pool.query(`
      CREATE POLICY "Public can insert inventory products"
      ON inventory_products FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
    `);
    console.log('✅ Created INSERT policy');
    
    // Allow anon users to update products
    await pool.query(`
      CREATE POLICY "Public can update inventory products"
      ON inventory_products FOR UPDATE
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
    `);
    console.log('✅ Created UPDATE policy');
    
    // Allow anon users to delete products
    await pool.query(`
      CREATE POLICY "Public can delete inventory products"
      ON inventory_products FOR DELETE
      TO anon, authenticated
      USING (true);
    `);
    console.log('✅ Created DELETE policy');
    
    console.log('\n✅ All anon policies created successfully');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
addAnonPolicy();
