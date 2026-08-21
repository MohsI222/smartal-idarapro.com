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
    console.log('🚀 Applying Auto & Real Estate permission and wedding invitations security migration...');
    
    const migrationPath = join(__dirname, 'supabase/migrations/20260814000000_add_auto_real_estate_permission_and_restrict_wedding.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Migration applied successfully!');
    console.log('📋 Changes applied:');
    console.log('   - Added can_access_auto_real_estate permission to permissions table');
    console.log('   - Updated wedding_invitations RLS policies to restrict access to super admin only (lahcenm534@gmail.com)');
    console.log('🔒 Wedding invitations are now protected and only accessible by the super admin');
    console.log('🏠 Auto & Real Estate module is now protected with permission-based access control');
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
