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
    console.log('🔧 Revoking anon table grants from sensitive tables...');
    
    const migrationSQL = fs.readFileSync('./supabase/migrations/20260817000027_revoke_anon_table_grants.sql', 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Anon table grants revoked successfully');
    console.log('🎉 Sensitive tables now fully protected from anon access');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

applyMigration();
