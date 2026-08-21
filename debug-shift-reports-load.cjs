const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function debugShiftReportsLoad() {
  try {
    console.log('🔍 Debugging shift reports loading...\n');
    
    const primaryUserId = '0b2f773e-10f2-4d1b-8430-1751863596f3';
    const today = new Date().toISOString().split('T')[0];
    
    console.log('📋 Query parameters:');
    console.log(`- User ID: ${primaryUserId}`);
    console.log(`- Today: ${today}`);
    console.log(`- Shift groups: A, B, C\n`);
    
    // Check for shift reports today
    const shiftReports = await pool.query(
      'SELECT id, user_id, shift_date, shift_group, start_time, end_time, sales_count, stock_add_count, operations_log FROM shift_reports WHERE user_id = $1 AND shift_date = $2 ORDER BY shift_group',
      [primaryUserId, today]
    );
    
    console.log(`📊 Found ${shiftReports.rows.length} shift reports for today`);
    
    if (shiftReports.rows.length === 0) {
      console.log('⚠️  No shift reports found for today');
      
      // Check if there are any shift reports at all
      const allReports = await pool.query('SELECT COUNT(*) as count, MIN(shift_date) as min_date, MAX(shift_date) as max_date FROM shift_reports WHERE user_id = $1', [primaryUserId]);
      console.log(`\n📊 Total shift reports for user: ${allReports.rows[0].count}`);
      console.log(`Date range: ${allReports.rows[0].min_date} to ${allReports.rows[0].max_date}`);
      
      // Show recent reports
      const recentReports = await pool.query('SELECT id, shift_date, shift_group, sales_count FROM shift_reports WHERE user_id = $1 ORDER BY shift_date DESC LIMIT 5', [primaryUserId]);
      console.log('\n📋 Recent shift reports:');
      recentReports.rows.forEach((r, i) => {
        console.log(`${i + 1}. Date: ${r.shift_date}, Group: ${r.shift_group}, Sales: ${r.sales_count}`);
      });
    } else {
      console.log('\n📋 Shift reports details:');
      shiftReports.rows.forEach((r, i) => {
        console.log(`\n${i + 1}. Report ID: ${r.id}`);
        console.log(`   Shift Group: ${r.shift_group}`);
        console.log(`   Start Time: ${r.start_time}`);
        console.log(`   End Time: ${r.end_time}`);
        console.log(`   Sales Count: ${r.sales_count}`);
        console.log(`   Stock Add Count: ${r.stock_add_count}`);
        console.log(`   Operations Log: ${r.operations_log ? `${r.operations_log.length} operations` : 'null/empty'}`);
        
        if (r.operations_log && r.operations_log.length > 0) {
          console.log('   Sample operations:');
          r.operations_log.slice(0, 3).forEach((log, idx) => {
            console.log(`     ${idx + 1}. ${log.action} - ${log.details}`);
          });
        }
      });
    }
    
    // Test the exact query the frontend uses
    console.log('\n🧪 Testing frontend query (Shift A):');
    const shiftA = await pool.query(
      'SELECT * FROM shift_reports WHERE shift_date = $1 AND shift_group = $2 AND user_id = $3',
      [today, 'A', primaryUserId]
    );
    console.log(`✅ Shift A query result: ${shiftA.rows.length} rows`);
    if (shiftA.rows.length > 0) {
      console.log(`   Report ID: ${shiftA.rows[0].id}`);
      console.log(`   Operations: ${shiftA.rows[0].operations_log?.length || 0}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
debugShiftReportsLoad();
