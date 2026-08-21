const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL or DIRECT_URL not found in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { 
    rejectUnauthorized: false,
    mode: 'require'
  }
});

async function applyMigration() {
  const client = await pool.connect();
  try {
    console.log('Applying migration: Add updated_at to inventory_products...');
    
    // Add updated_at column if it doesn't exist
    await client.query(`
      ALTER TABLE public.inventory_products 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
    `);
    console.log('✓ Added updated_at column');
    
    // Create function to update updated_at timestamp
    await client.query(`
      CREATE OR REPLACE FUNCTION update_inventory_products_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    console.log('✓ Created update_inventory_products_updated_at function');
    
    // Drop existing trigger if exists
    await client.query(`
      DROP TRIGGER IF EXISTS trigger_update_inventory_products_updated_at ON public.inventory_products
    `);
    console.log('✓ Dropped existing trigger (if any)');
    
    // Create trigger to automatically update updated_at on row update
    await client.query(`
      CREATE TRIGGER trigger_update_inventory_products_updated_at
        BEFORE UPDATE ON public.inventory_products
        FOR EACH ROW
        EXECUTE FUNCTION update_inventory_products_updated_at()
    `);
    console.log('✓ Created trigger for updated_at');
    
    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration().catch(console.error);
