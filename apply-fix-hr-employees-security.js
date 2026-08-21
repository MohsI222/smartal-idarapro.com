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
    console.log('🔧 Applying HR employees security fix...');
    
    const migrationSQL = fs.readFileSync('./supabase/migrations/20260817000020_fix_hr_employees_security.sql', 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ HR employees security fix applied successfully');
    console.log('🎉 RLS enabled with user isolation - users can only see their own records');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

applyMigration();
