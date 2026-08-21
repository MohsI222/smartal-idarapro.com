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
    console.log('🚀 Applying Clean hr_employees Policies migration...');
    
    const migrationPath = join(__dirname, 'supabase/migrations/20260817000001_clean_hr_employees_policies.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Clean hr_employees Policies migration applied successfully!');
    console.log('🔒 hr_employees policies have been cleaned and secured:');
    console.log('   - Removed all conflicting policies');
    console.log('   - Enforced strict user isolation');
    console.log('   - Added super admin override policies');
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
