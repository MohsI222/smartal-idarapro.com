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
    console.log('🔧 Removing remaining anon policies from sensitive tables...');
    
    const migrationSQL = fs.readFileSync('./supabase/migrations/20260817000025_remove_remaining_anon_policies.sql', 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Remaining anon policies removed successfully');
    console.log('🎉 Sensitive tables now fully protected');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

applyMigration();
