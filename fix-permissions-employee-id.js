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

async function fixPermissionsEmployeeId() {
  try {
    console.log('🔧 Fixing permissions employee_id linkage...\n');
    
    // Step 1: Delete permissions with null employee_id
    console.log('🗑️ Deleting old permissions with null employee_id...');
    const { rowCount: deletedCount } = await pool.query(`
      DELETE FROM permissions WHERE employee_id IS NULL
    `);
    console.log(`✅ Deleted ${deletedCount} old permission records`);
    
    // Step 2: Get all hr_employees
    console.log('\n📋 Fetching all hr_employees...');
    const { rows: employees } = await pool.query(`
      SELECT id, name, work_number, user_id
      FROM hr_employees
      ORDER BY created_at DESC
    `);
    console.log(`✅ Found ${employees.length} employees`);
    
    // Step 3: Create permissions for each employee
    console.log('\n🔐 Creating permissions for each employee...');
    for (const emp of employees) {
      const { rows: existing } = await pool.query(`
        SELECT id FROM permissions WHERE employee_id = $1
      `, [emp.id]);
      
      if (existing.length === 0) {
        await pool.query(`
          INSERT INTO permissions (
            employee_id,
            can_access_inventory,
            can_access_hr,
            can_access_delivery,
            can_access_transport_logistics,
            can_access_wedding_invitations,
            can_access_legal,
            can_access_ai,
            can_access_settings,
            is_admin
          ) VALUES ($1, true, true, true, true, true, true, true, true, false)
        `, [emp.id]);
        console.log(`✅ Created permissions for: ${emp.name} (Work: ${emp.work_number || 'null'})`);
      } else {
        console.log(`⏭️ Permissions already exist for: ${emp.name} (Work: ${emp.work_number || 'null'})`);
      }
    }
    
    // Step 4: Set first employee as admin (or a specific one)
    console.log('\n👑 Setting admin permissions...');
    const { rows: firstEmployee } = await pool.query(`
      SELECT id, name, work_number FROM hr_employees ORDER BY created_at DESC LIMIT 1
    `);
    
    if (firstEmployee.length > 0) {
      await pool.query(`
        UPDATE permissions SET is_admin = true WHERE employee_id = $1
      `, [firstEmployee[0].id]);
      console.log(`✅ Set ${firstEmployee[0].name} (Work: ${firstEmployee[0].work_number || 'null'}) as admin`);
    }
    
    // Step 5: Verify
    console.log('\n🔍 Verifying permissions...');
    const { rows: finalPermissions } = await pool.query(`
      SELECT p.*, e.name as employee_name, e.work_number
      FROM permissions p
      LEFT JOIN hr_employees e ON p.employee_id = e.id
      ORDER BY e.name
    `);
    
    console.log(`\n📊 Final permissions count: ${finalPermissions.length}`);
    finalPermissions.forEach(perm => {
      const adminBadge = perm.is_admin ? '👑' : '  ';
      console.log(`   ${adminBadge} ${perm.employee_name} (Work: ${perm.work_number || 'null'})`);
    });
    
    console.log('\n✅ Permissions fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixPermissionsEmployeeId();
