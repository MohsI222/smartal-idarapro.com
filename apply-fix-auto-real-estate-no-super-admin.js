import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function applyMigration() {
  try {
    console.log('🔧 Applying fix to remove super admin policy from auto_real_estate...');
    
    const migrationSQL = fs.readFileSync('./supabase/migrations/20260817000018_fix_auto_real_estate_no_super_admin.sql', 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Fix applied successfully');
    console.log('🎉 Super admin policy removed - users can now add products without errors');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

applyMigration();
