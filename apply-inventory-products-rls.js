import { Pool } from 'pg';
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Disable SSL warnings for this migration script
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function applyMigration() {
  try {
    console.log('🚀 Disabling RLS for inventory_products table...');
    
    const migrationPath = join(__dirname, 'supabase/migrations/20260810000001_disable_rls_inventory_products.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ RLS disabled successfully!');
    console.log('📋 inventory_products is now accessible without RLS restrictions');
    console.log('🔒 Security: User filtering is handled at the application level');
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
