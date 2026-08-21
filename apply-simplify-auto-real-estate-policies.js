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
    console.log('🔧 Applying simplified RLS policies for auto_real_estate...');
    
    const migrationSQL = fs.readFileSync('./supabase/migrations/20260817000019_simplify_auto_real_estate_policies.sql', 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Simplified policies applied successfully');
    console.log('🎉 All users can now add products without restrictions');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

applyMigration();
