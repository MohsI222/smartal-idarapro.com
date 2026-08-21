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
    console.log('🚀 Applying Security Advisor fixes migration...');
    
    const migrationPath = join(__dirname, 'supabase/migrations/20260817000001_fix_security_advisor_warnings.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Migration applied successfully!');
    console.log('📋 Changes applied:');
    console.log('   - Revoke EXECUTE from anon for SECURITY DEFINER functions');
    console.log('   - Add explicit search_path to SECURITY DEFINER functions');
    console.log('   - Re-grant proper permissions to authenticated only');
    console.log('🔒 Security Advisor warnings and errors should now be resolved');
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
