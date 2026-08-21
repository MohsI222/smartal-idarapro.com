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
    console.log('🔧 Applying HR absence records security fix...');
    
    const migrationSQL = fs.readFileSync('./supabase/migrations/20260817000021_fix_hr_absence_records_security.sql', 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ HR absence records security fix applied successfully');
    console.log('🎉 Simplified policies with user isolation');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

applyMigration();
