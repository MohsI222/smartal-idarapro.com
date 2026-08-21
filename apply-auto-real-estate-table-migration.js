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
    console.log('🚀 Applying auto_real_estate table with RLS migration...');
    
    const migrationPath = join(__dirname, 'supabase/migrations/20260814000001_auto_real_estate_table_with_rls.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Migration applied successfully!');
    console.log('📋 Changes applied:');
    console.log('   - Created auto_real_estate table with proper schema');
    console.log('   - Enabled Row Level Security (RLS)');
    console.log('   - Users can only access their own data');
    console.log('   - Super admin (lahcenm534@gmail.com) can access all data');
    console.log('   - Added indexes for performance');
    console.log('   - Enabled Realtime for live updates');
    console.log('🔒 Auto & Real Estate data is now properly protected in database');
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
