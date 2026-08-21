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
    console.log('🔧 Enabling RLS on auto_real_estate table...');
    
    const migrationSQL = fs.readFileSync('./supabase/migrations/20260818000000_enable_rls_auto_real_estate.sql', 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ RLS enabled on auto_real_estate successfully');
    console.log('🎉 Security improved - auto_real_estate now has RLS enabled');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

applyMigration();
