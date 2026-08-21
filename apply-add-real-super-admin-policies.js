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
    console.log('🔧 Adding real Super Admin RLS policies at database level...');
    
    const migrationSQL = fs.readFileSync('./supabase/migrations/20260817000028_add_real_super_admin_policies.sql', 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Super Admin RLS policies added successfully');
    console.log('🎉 lahcenm534@gmail.com now has full database-level access');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

applyMigration();
