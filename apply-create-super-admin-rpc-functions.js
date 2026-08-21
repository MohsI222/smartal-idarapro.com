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
    console.log('🔧 Creating Super Admin RPC functions...');
    
    const migrationSQL = fs.readFileSync('./supabase/migrations/20260817000032_create_super_admin_rpc_functions.sql', 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Super Admin RPC functions created successfully');
    console.log('🎉 Functions now allow Super Admin to bypass RLS safely');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

applyMigration();
