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
    console.log('🚀 Applying is_super_admin function permissions migration...');
    
    const migrationPath = join(__dirname, 'supabase/migrations/20260817000000_grant_is_super_admin_permissions.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Migration applied successfully!');
    console.log('📋 Changes applied:');
    console.log('   - GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated');
    console.log('   - GRANT EXECUTE ON FUNCTION is_super_admin() TO anon');
    console.log('   - ALTER FUNCTION is_super_admin() SECURITY DEFINER');
    console.log('🔒 is_super_admin function now has proper permissions for saving products');
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
