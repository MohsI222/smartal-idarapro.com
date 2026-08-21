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
    console.log('🔧 Removing dangerous policy from auto_real_estate...');
    
    const migrationSQL = fs.readFileSync('./supabase/migrations/20260818000001_remove_dangerous_auto_real_estate_policy.sql', 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Dangerous policy removed successfully');
    console.log('🎉 Security improved - auto_real_estate is now properly protected');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

applyMigration();
