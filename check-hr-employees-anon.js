import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkHrEmployeesAnon() {
  try {
    console.log('🔍 Checking hr_employees RLS policies...\n');
    
    const { rows: policies } = await pool.query(
      `SELECT policyname, cmd, roles, qual, with_check 
       FROM pg_policies 
       WHERE tablename = 'hr_employees' AND schemaname = 'public'`
    );
    
    console.log('Current policies:');
    policies.forEach(p => {
      console.log(`\n📋 ${p.policyname}`);
      console.log(`   Command: ${p.cmd}`);
      console.log(`   Roles: ${p.roles}`);
      if (p.qual) console.log(`   USING: ${p.qual}`);
      if (p.with_check) console.log(`   WITH CHECK: ${p.with_check}`);
    });
    
    // Check anon grants
    const { rows: anonGrants } = await pool.query(
      `SELECT privilege_type 
       FROM information_schema.role_table_grants 
       WHERE table_name = 'hr_employees' 
       AND grantee = 'anon' 
       AND table_schema = 'public'`
    );
    
    console.log('\nAnon privileges:');
    anonGrants.forEach(g => {
      console.log(`   - ${g.privilege_type}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkHrEmployeesAnon();
