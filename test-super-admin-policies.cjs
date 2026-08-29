/**
 * Test super admin policies directly in database
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in .env file');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL + '?sslmode=disable',
});

async function testPolicies() {
  const client = await pool.connect();
  try {
    const superAdminId = 'c905d8d6-dcbd-4414-8214-7300ff6c7552'; // lahcenm534@gmail.com
    
    console.log('\n=== Testing Super Admin Policies ===\n');
    console.log('Super Admin ID:', superAdminId);
    console.log('Super Admin Email: lahcenm534@gmail.com\n');
    
    // Test 1: Check if user has superadmin role
    console.log('Test 1: Check user role');
    const roleCheck = await client.query(`
      SELECT role FROM public.users WHERE id = $1
    `, [superAdminId]);
    console.log('Role:', roleCheck.rows[0]?.role);
    
    // Test 2: Try to SELECT from hr_employees with RLS
    console.log('\nTest 2: SELECT from hr_employees (with RLS)');
    try {
      // Set the auth.uid() for this session
      await client.query(`SET LOCAL request.jwt.claims to '{"sub": "${superAdminId}", "email": "lahcenm534@gmail.com"}'`);
      await client.query(`SET LOCAL request.user.id to '${superAdminId}'`);
      
      const selectTest = await client.query(`
        SELECT COUNT(*) as count FROM public.hr_employees
      `);
      console.log('✓ Can SELECT from hr_employees:', selectTest.rows[0].count, 'rows');
    } catch (err) {
      console.log('✗ Cannot SELECT from hr_employees:', err.message);
    }
    
    // Test 3: Try to DELETE from hr_employees with RLS
    console.log('\nTest 3: DELETE from hr_employees (with RLS)');
    try {
      await client.query(`SET LOCAL request.jwt.claims to '{"sub": "${superAdminId}", "email": "lahcenm534@gmail.com"}'`);
      await client.query(`SET LOCAL request.user.id to '${superAdminId}'`);
      
      // Try to delete a non-existent row to test permission
      const deleteTest = await client.query(`
        DELETE FROM public.hr_employees WHERE id = '00000000-0000-0000-0000-000000000000'
      `);
      console.log('✓ Can DELETE from hr_employees (permission granted)');
    } catch (err) {
      console.log('✗ Cannot DELETE from hr_employees:', err.message);
    }
    
    // Test 4: Try to INSERT into hr_absence_records with RLS
    console.log('\nTest 4: INSERT into hr_absence_records (with RLS)');
    try {
      await client.query(`SET LOCAL request.jwt.claims to '{"sub": "${superAdminId}", "email": "lahcenm534@gmail.com"}'`);
      await client.query(`SET LOCAL request.user.id to '${superAdminId}'`);
      
      // Try to insert with a fake UUID to test permission
      const insertTest = await client.query(`
        INSERT INTO public.hr_absence_records (id, user_id, employee_id, from_date, to_date, reason)
        VALUES ('00000000-0000-0000-0000-000000000000', '${superAdminId}', 'TEST', NOW(), NOW(), 'test')
      `);
      console.log('✓ Can INSERT into hr_absence_records (permission granted)');
      // Rollback the test insert
      await client.query('ROLLBACK');
    } catch (err) {
      console.log('✗ Cannot INSERT into hr_absence_records:', err.message);
      await client.query('ROLLBACK');
    }
    
    // Test 5: Check if RLS is enabled
    console.log('\nTest 5: Check RLS status');
    const rlsCheck = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('hr_employees', 'hr_absence_records')
    `);
    console.table(rlsCheck.rows);
    
    // Test 6: Check the actual policy conditions
    console.log('\nTest 6: Check policy conditions for super admin');
    const policyCheck = await client.query(`
      SELECT policyname, 
             CASE 
               WHEN qual IS NOT NULL THEN 'USING: ' || substring(qual, 1, 100)
               ELSE 'WITH CHECK: ' || substring(with_check, 1, 100)
             END as condition
      FROM pg_policies 
      WHERE tablename IN ('hr_employees', 'hr_absence_records') 
      AND schemaname = 'public'
      AND policyname LIKE '%Super admin%'
      ORDER BY tablename, policyname
    `);
    console.table(policyCheck.rows);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
  }
  
  await pool.end();
}

testPolicies().catch(console.error);
