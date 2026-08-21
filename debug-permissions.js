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

async function debugPermissions() {
  try {
    console.log('🔍 Debugging permissions issue...\n');
    
    // Check permissions table
    const { rows: permissions } = await pool.query(`
      SELECT * FROM permissions
    `);
    console.log(`📋 Permissions table: ${permissions.length} rows`);
    permissions.forEach(p => {
      console.log(`   - User ID: ${p.user_id}, Admin: ${p.is_admin}`);
    });
    
    // Check HR employees
    const { rows: employees } = await pool.query(`
      SELECT id, name, employee_id FROM hr_employees LIMIT 5
    `);
    console.log(`\n👥 HR Employees: ${employees.length} rows`);
    employees.forEach(e => {
      console.log(`   - ID: ${e.id}, Name: ${e.name}, Employee ID: ${e.employee_id}`);
    });
    
    // Check auth users
    const { rows: authUsers } = await pool.query(`
      SELECT id, email, raw_user_meta_data->>'name' as name 
      FROM auth.users 
      LIMIT 5
    `);
    console.log(`\n🔐 Auth Users: ${authUsers.length} rows`);
    authUsers.forEach(u => {
      console.log(`   - ID: ${u.id}, Email: ${u.email}, Name: ${u.name}`);
    });
    
    // Check if employee IDs match permission user IDs
    console.log('\n🔗 Checking employee ID vs permission user ID matching:');
    const employeeIds = employees.map(e => e.id);
    const permissionUserIds = permissions.map(p => p.user_id);
    
    const matchingIds = employeeIds.filter(id => permissionUserIds.includes(id));
    console.log(`   Matching IDs: ${matchingIds.length}`);
    
    if (matchingIds.length === 0) {
      console.log('   ⚠️  No matching IDs found! This is the problem.');
      console.log('   HR employees use different IDs than auth.users');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

debugPermissions();
