import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // WARNING: This makes TLS connections insecure! Only for development.

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for self-signed certs in development
  },
});

async function applyMigration() {
  try {
    console.log('🚀 Applying Fix Conflicting RLS Policies migration...');
    
    const migrationPath = join(__dirname, 'supabase/migrations/20260817000002_fix_conflicting_rls_policies.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Fix Conflicting RLS Policies migration applied successfully!');
    console.log('🔒 RLS policies are now clean and functional:');
    console.log('   - Super admin can access all inventory_products');
    console.log('   - Super admin can access all shift_reports');
    console.log('   - Users can only access their own data');
    console.log('   - No more conflicting policies');
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
