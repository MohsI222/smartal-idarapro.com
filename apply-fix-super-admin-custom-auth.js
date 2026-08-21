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
    console.log('🔧 Fixing Super Admin function for custom JWT authentication...');
    
    const migrationSQL = fs.readFileSync('./supabase/migrations/20260817000030_fix_super_admin_custom_auth.sql', 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Super Admin function fixed successfully');
    console.log('🎉 Function now checks role from public.users for custom JWT auth');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

applyMigration();
