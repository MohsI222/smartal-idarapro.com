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
    console.log('🔧 Removing RLS for Super Admin (bypass all restrictions)...');
    
    const migrationSQL = fs.readFileSync('./supabase/migrations/20260817000033_remove_rls_for_super_admin.sql', 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ RLS removed for Super Admin successfully');
    console.log('⚠️  WARNING: This allows ALL authenticated users to bypass RLS');
    console.log('📝 Security is now handled at application layer via authMiddleware');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

applyMigration();
