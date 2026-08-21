const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkShiftReportsRLS() {
  try {
    console.log('🔍 Checking shift_reports RLS policies...\n');
    
    // Check if RLS is enabled
    const rlsStatus = await pool.query(`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relname = 'shift_reports'
    `);
    
    console.log('📋 RLS Status:', rlsStatus.rows[0]);
    
    // Get current policies
    const policies = await pool.query(`
      SELECT policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies 
      WHERE tablename = 'shift_reports'
    `);
    
    console.log(`\n📋 Current policies (${policies.rows.length}):`);
    policies.rows.forEach((p, i) => {
      console.log(`${i + 1}. ${p.policyname}`);
      console.log(`   Command: ${p.cmd}`);
      console.log(`   Roles: ${p.roles}`);
      console.log(`   Using: ${p.qual}`);
      console.log(`   With Check: ${p.with_check}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}
checkShiftReportsRLS();
