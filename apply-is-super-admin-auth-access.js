import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function applyMigration() {
  try {
    console.log('🚀 Applying is_super_admin auth access fix migration...');
    
    const migrationPath = join(__dirname, 'supabase/migrations/20260817000002_fix_is_super_admin_auth_access.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Migration applied successfully!');
    console.log('📋 Changes applied:');
    console.log('   - Grant USAGE on auth schema to postgres');
    console.log('   - Grant SELECT on auth.users to postgres');
    console.log('   - Recreate is_super_admin with auth in search_path');
    console.log('   - Ensure proper EXECUTE permissions');
    console.log('🔒 is_super_admin function can now properly access auth.users');
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
