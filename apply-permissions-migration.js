import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function applyMigration() {
  try {
    console.log('🚀 Applying Permissions migration...');
    
    const migrationPath = join(__dirname, 'supabase/migrations/20260803000000_permissions_table.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Permissions migration applied successfully!');
    console.log('📋 The permissions table has been created with the following columns:');
    console.log('   - user_id: Reference to the user in auth.users');
    console.log('   - can_access_inventory: Permission to access inventory/POS module');
    console.log('   - can_access_hr: Permission to access HR module');
    console.log('   - can_access_delivery: Permission to access delivery hub module');
    console.log('   - can_access_transport_logistics: Permission to access transport logistics module');
    console.log('   - can_access_wedding_invitations: Permission to access wedding invitations module');
    console.log('   - can_access_legal: Permission to access legal module');
    console.log('   - can_access_ai: Permission to access AI features');
    console.log('   - can_access_settings: Permission to access settings');
    console.log('   - is_admin: Admin flag - admins can manage other users permissions');
    console.log('🔒 RLS policies have been enabled for data security');
    console.log('📡 Realtime has been enabled for permissions table');
  } catch (error) {
    console.error('❌ Error applying Permissions migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
