import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkSuperAdminUser() {
  try {
    console.log('🔍 Checking Super Admin user in auth.users...\n');
    
    const SUPER_ADMIN_EMAIL = 'lahcenm534@gmail.com';
    
    // Check auth.users for Super Admin email
    const { rows: authUsers } = await pool.query(
      `SELECT id, email, created_at 
       FROM auth.users 
       WHERE email = $1`,
      [SUPER_ADMIN_EMAIL]
    );
    
    console.log('Auth users with Super Admin email:');
    authUsers.forEach(u => {
      console.log(`   - ID: ${u.id}, Email: ${u.email}`);
    });
    
    // Check public.users for Super Admin email
    const { rows: publicUsers } = await pool.query(
      `SELECT id, email, name, role 
       FROM users 
       WHERE email = $1`,
      [SUPER_ADMIN_EMAIL]
    );
    
    console.log('\nPublic users with Super Admin email:');
    publicUsers.forEach(u => {
      console.log(`   - ID: ${u.id}, Email: ${u.email}, Role: ${u.role}, Name: ${u.name}`);
    });
    
    // Check the user ID from the error logs
    const errorUserId = 'c905d8d6-dcbd-4414-8214-7300ff6c7552';
    console.log(`\nChecking user ID from error logs: ${errorUserId}`);
    
    const { rows: errorUser } = await pool.query(
      `SELECT id, email, name, role 
       FROM users 
       WHERE id = $1`,
      [errorUserId]
    );
    
    if (errorUser.length > 0) {
      console.log('User from error logs:');
      errorUser.forEach(u => {
        console.log(`   - ID: ${u.id}, Email: ${u.email}, Role: ${u.role}, Name: ${u.name}`);
      });
    } else {
      console.log('   User not found in public.users');
    }
    
    // Check auth.users for this ID
    const { rows: authErrorUser } = await pool.query(
      `SELECT id, email 
       FROM auth.users 
       WHERE id = $1`,
      [errorUserId]
    );
    
    if (authErrorUser.length > 0) {
      console.log('Auth user from error logs:');
      authErrorUser.forEach(u => {
        console.log(`   - ID: ${u.id}, Email: ${u.email}`);
      });
    } else {
      console.log('   User not found in auth.users');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSuperAdminUser();
