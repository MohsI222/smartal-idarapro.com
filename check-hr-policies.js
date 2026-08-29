import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function checkPolicies() {
  try {
    console.log('🔍 Checking current RLS policies for HR tables...\n');
    
    // Check hr_employees policies
    const employeesPolicies = await pool.query(`
      SELECT policyname, cmd, roles, qual, with_check
      FROM pg_policies 
      WHERE tablename = 'hr_employees' 
      AND schemaname = 'public'
      ORDER BY policyname
    `);
    
    console.log('📋 hr_employees policies:');
    console.log('Policy Name | Command | Roles | Using | With Check');
    console.log('--- | --- | --- | --- | ---');
    employeesPolicies.rows.forEach(policy => {
      console.log(`${policy.policyname} | ${policy.cmd} | ${policy.roles} | ${policy.qual || 'N/A'} | ${policy.with_check || 'N/A'}`);
    });
    
    console.log('\n');
    
    // Check hr_absence_records policies
    const absencePolicies = await pool.query(`
      SELECT policyname, cmd, roles, qual, with_check
      FROM pg_policies 
      WHERE tablename = 'hr_absence_records' 
      AND schemaname = 'public'
      ORDER BY policyname
    `);
    
    console.log('📋 hr_absence_records policies:');
    console.log('Policy Name | Command | Roles | Using | With Check');
    console.log('--- | --- | --- | --- | ---');
    absencePolicies.rows.forEach(policy => {
      console.log(`${policy.policyname} | ${policy.cmd} | ${policy.roles} | ${policy.qual || 'N/A'} | ${policy.with_check || 'N/A'}`);
    });
    
    console.log('\n');
    
    // Check if RLS is enabled
    const rlsStatus = await pool.query(`
      SELECT tablename, relrowsecurity 
      FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      WHERE t.schemaname = 'public' 
      AND t.tablename IN ('hr_employees', 'hr_absence_records')
    `);
    
    console.log('🔒 RLS Status:');
    rlsStatus.rows.forEach(row => {
      console.log(`${row.tablename}: ${row.relrowsecurity ? 'ENABLED' : 'DISABLED'}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking policies:', error.message);
  } finally {
    await pool.end();
  }
}

checkPolicies();
