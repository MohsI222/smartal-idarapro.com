const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixShiftReportsOperationsLog() {
  try {
    console.log('🔧 Fixing shift_reports operations_log...\n');
    
    // Get all shift reports
    const allReports = await pool.query('SELECT id, operations_log FROM shift_reports');
    console.log(`📋 Total shift reports: ${allReports.rows.length}`);
    
    let fixed = 0;
    
    for (const report of allReports.rows) {
      let operationsLog = report.operations_log;
      
      // Fix operations_log if it's not an array
      if (!operationsLog) {
        operationsLog = [];
        await pool.query('UPDATE shift_reports SET operations_log = $1 WHERE id = $2', [JSON.stringify(operationsLog), report.id]);
        console.log(`✅ Fixed null operations_log for report ${report.id}`);
        fixed++;
      } else if (typeof operationsLog === 'string') {
        try {
          operationsLog = JSON.parse(operationsLog);
          if (!Array.isArray(operationsLog)) {
            operationsLog = [];
          }
          await pool.query('UPDATE shift_reports SET operations_log = $1 WHERE id = $2', [JSON.stringify(operationsLog), report.id]);
          console.log(`✅ Fixed string operations_log for report ${report.id}`);
          fixed++;
        } catch (e) {
          operationsLog = [];
          await pool.query('UPDATE shift_reports SET operations_log = $1 WHERE id = $2', [JSON.stringify(operationsLog), report.id]);
          console.log(`✅ Fixed invalid JSON operations_log for report ${report.id}`);
          fixed++;
        }
      } else if (!Array.isArray(operationsLog)) {
        operationsLog = [];
        await pool.query('UPDATE shift_reports SET operations_log = $1 WHERE id = $2', [JSON.stringify(operationsLog), report.id]);
        console.log(`✅ Fixed non-array operations_log for report ${report.id}`);
        fixed++;
      }
    }
    
    console.log(`\n📊 Fixed ${fixed} shift reports`);
    
    // Verify the fix
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
      console.log(`   operations_log type: ${Array.isArray(report.operations_log) ? 'array' : typeof report.operations_log}`);
      console.log(`   operations_log length: ${Array.isArray(report.operations_log) ? report.operations_log.length : 'N/A'}`);
      
      if (Array.isArray(report.operations_log) && report.operations_log.length > 0) {
        console.log('\n📋 Sample operations:');
        report.operations_log.slice(0, 3).forEach((log, idx) => {
          console.log(`   ${idx + 1}. ${log.action} - ${log.details}`);
        });
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
fixShiftReportsOperationsLog();
