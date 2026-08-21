import { Pool } from 'pg';
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Disable SSL warnings for this migration script
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function applyMigration() {
  try {
    console.log('🚀 Creating shift_reports table...');
    
    const migrationPath = join(__dirname, 'supabase/migrations/20260810000002_shift_reports.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Shift reports table created successfully!');
    console.log('📋 Features:');
    console.log('   - Shift groups (A, B, C)');
    console.log('   - Time tracking (start/end)');
    console.log('   - Customer info (name, phone)');
    console.log('   - Sales tracking (total sales, items sold)');
    console.log('   - Inventory tracking (remaining stock, sold products)');
    console.log('   - Expiry tracking (expired products)');
    console.log('   - Production tracking');
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
