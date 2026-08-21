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
    console.log('🔧 Adding direct Super Admin RLS policies (no function dependency)...');
    
    const migrationSQL = fs.readFileSync('./supabase/migrations/20260817000031_add_direct_super_admin_policies.sql', 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Direct Super Admin RLS policies added successfully');
    console.log('🎉 Policies now check role directly in public.users');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

applyMigration();
