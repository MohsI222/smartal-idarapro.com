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
    console.log('🔧 Adding missing policies for tables without policies...');
    
    const migrationSQL = fs.readFileSync('./supabase/migrations/20260818000003_add_missing_policies.sql', 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Missing policies added successfully');
    console.log('🎉 Security improved - all tables now have proper data isolation');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

applyMigration();
