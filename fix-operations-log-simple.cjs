const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixOperationsLogSimple() {
  try {
    console.log('🔧 Fixing shift_reports operations_log...\n');
    
    // Update all shift reports to ensure operations_log is a valid JSON array
    const result = await pool.query(`
      UPDATE shift_reports 
      SET operations_log = CASE 
        WHEN operations_log IS NULL THEN '[]'::jsonb
        WHEN jsonb_typeof(operations_log) != 'array' THEN '[]'::jsonb
        ELSE operations_log
      END
    `);
    
    console.log(`✅ Updated ${result.rowCount} shift reports`);
    
    // Verify
    const primaryUserId = '0b2f773e-10f2-4d1b-8430-1751863596f3';
    const today = new Date().toISOString().split('T')[0];
    
    const testReport = await pool.query(
      'SELECT id, operations_log FROM shift_reports WHERE user_id = $1 AND shift_date = $2 AND shift_group = $3 ORDER BY created_at DESC LIMIT 1',
      [primaryUserId, today, 'A']
    );
    
    if (testReport.rows.length > 0) {
      const report = testReport.rows[0];
      console.log('\n🧪 Verification:');
      console.log(`   Report ID: ${report.id}`);
      console.log(`   operations_log type: ${typeof report.operations_log}`);
      console.log(`   operations_log is array: ${Array.isArray(report.operations_log)}`);
      
      if (report.operations_log) {
        const ops = Array.isArray(report.operations_log) ? report.operations_log : [];
        console.log(`   operations_log length: ${ops.length}`);
        
        if (ops.length > 0) {
          console.log('\n📋 Sample operations:');
          ops.slice(0, 3).forEach((log, idx) => {
            console.log(`   ${idx + 1}. ${log.action} - ${log.details}`);
          });
        }
      }
    }
    
    console.log('\n✅ All shift reports operations_log fixed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
fixOperationsLogSimple();
