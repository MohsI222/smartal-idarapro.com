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
    console.log('🔧 Removing unsafe Super Admin policies and restoring user isolation...');
    
    const migrationSQL = fs.readFileSync('./supabase/migrations/20260817000034_remove_unsafe_super_admin_policies.sql', 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Unsafe policies removed successfully');
    console.log('🎉 User isolation restored with user_id');
    console.log('📝 Super Admin should use RPC functions for full access');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

applyMigration();
