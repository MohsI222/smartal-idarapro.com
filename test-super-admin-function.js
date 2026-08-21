import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function testSuperAdminFunction() {
  try {
    console.log('🔍 Testing Super Admin function...\n');
    
    // Test the function with the Super Admin user ID
    const SUPER_ADMIN_USER_ID = 'c905d8d6-dcbd-4414-8214-7300ff6c7552';
    
    // Test by simulating auth.uid() = SUPER_ADMIN_USER_ID
    const { rows: result } = await pool.query(
      `SELECT public.is_current_user_super_admin() as is_super_admin`
    );
    
    console.log('Function test result:', result[0]);
    
    // Check the user role directly
    const { rows: userRole } = await pool.query(
      `SELECT id, email, role FROM public.users WHERE id = $1`,
      [SUPER_ADMIN_USER_ID]
    );
    
    console.log('\nSuper Admin user:');
    userRole.forEach(u => {
      console.log(`   - ID: ${u.id}, Email: ${u.email}, Role: ${u.role}`);
    });
    
    // Test the function logic manually
    const { rows: manualTest } = await pool.query(
      `SELECT 
        CASE 
          WHEN role = 'superadmin' THEN true
          ELSE false
        END as should_be_super_admin
       FROM public.users 
       WHERE id = $1`,
      [SUPER_ADMIN_USER_ID]
    );
    
    console.log('\nManual test result:', manualTest[0]);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testSuperAdminFunction();
