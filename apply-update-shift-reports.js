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
    console.log('🚀 Updating shift_reports table with operation tracking...');
    
    const migrationPath = join(__dirname, 'supabase/migrations/20260810000003_update_shift_reports.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Shift reports table updated successfully!');
    console.log('📋 New fields added:');
    console.log('   - sales_count: عدد المبيعات');
    console.log('   - stock_add_count: إضافة مخزون');
    console.log('   - stock_edit_count: تعديل مخزون');
    console.log('   - import_count: استيراد');
    console.log('   - export_count: تصدير');
    console.log('   - delete_count: حذف');
    console.log('   - total_operations: إجمالي العمليات');
    console.log('   - operations_log: سجل العمليات التفصيلي');
    console.log('   - shift_description: وصف النوبة');
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
