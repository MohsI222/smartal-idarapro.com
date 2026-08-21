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
    console.log('🚀 Applying User Data Isolation migration...');
    
    const migrationPath = join(__dirname, 'supabase/migrations/20260817000000_fix_user_data_isolation.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ User Data Isolation migration applied successfully!');
    console.log('🔒 User data isolation is now enforced:');
    console.log('   - Each user can only see their own data');
    console.log('   - Super admin can see all data');
    console.log('   - Fixed shift_reports security issue');
    console.log('   - Fixed inventory_products collaborative access');
    console.log('   - Fixed hr_employees collaborative access');
    console.log('   - Fixed permissions admin access');
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
