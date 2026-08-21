const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixRemainingShiftIds() {
  try {
    console.log('🔧 Fixing remaining shift_reports user_ids...\n');
    
    // Get all valid auth user IDs
    const authUsers = await pool.query('SELECT id, email FROM auth.users');
    const validUserIds = authUsers.rows.map(u => u.id);
    const primaryUserId = validUserIds[0]; // moutaouakullahcen@gmail.com
    
    console.log(`👥 Primary user: ${authUsers.rows[0].email} (${primaryUserId})`);
    
    // Fix remaining shift_reports
    console.log('\n📋 Fixing remaining shift_reports user_ids...');
    const shiftReports = await pool.query('SELECT id, user_id FROM shift_reports');
    let shiftFixed = 0;
    
    for (const report of shiftReports.rows) {
      if (!validUserIds.includes(report.user_id)) {
        await pool.query('UPDATE shift_reports SET user_id = $1 WHERE id = $2', [primaryUserId, report.id]);
        console.log(`✅ Updated report ${report.id} to user ${primaryUserId}`);
        shiftFixed++;
      }
    }
    console.log(`📊 Fixed ${shiftFixed} shift_reports`);
    
    // Verify the fix
    console.log('\n🔍 Verifying fix...');
    const shiftUserIds = await pool.query('SELECT DISTINCT user_id FROM shift_reports');
    console.log(`📋 Shift reports user_ids: ${shiftUserIds.rows.length}`);
    shiftUserIds.rows.forEach(u => console.log(`   ${u.user_id}`));
    
    console.log('\n✅ All shift_reports user_ids fixed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
fixRemainingShiftIds();
