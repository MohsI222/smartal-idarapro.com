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
    console.log('🔧 Applying RLS policies fix for auto_real_estate...');
    
    const migrationSQL = fs.readFileSync('./supabase/migrations/20260817000017_fix_auto_real_estate_rls.sql', 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ RLS policies updated successfully');
    console.log('🎉 Super admin now has full access to auto_real_estate table');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

applyMigration();
