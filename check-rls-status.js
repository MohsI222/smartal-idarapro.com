import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkRLSStatus() {
  try {
    console.log('🔍 Checking RLS status on key tables...\n');
    
    const tables = ['hr_employees', 'hr_absence_records', 'inventory_products', 'shift_reports'];
    
    for (const table of tables) {
      console.log(`\n📋 Table: ${table}`);
      
      // Check if RLS is enabled
      const { rows: rlsStatus } = await pool.query(
        `SELECT relname as table_name, relrowsecurity as rls_enabled 
         FROM pg_class 
         WHERE relname = $1 AND relnamespace = 'public'::regnamespace`,
        [table]
      );
      
      if (rlsStatus.length > 0) {
        console.log(`   RLS Enabled: ${rlsStatus[0].rls_enabled}`);
      } else {
        console.log(`   Table not found`);
      }
      
      // Check existing policies
      const { rows: policies } = await pool.query(
        `SELECT policyname, cmd, qual, with_check 
         FROM pg_policies 
         WHERE tablename = $1 AND schemaname = 'public' 
         ORDER BY policyname`,
        [table]
      );
      
      if (policies.length > 0) {
        console.log(`   Policies (${policies.length}):`);
        policies.forEach(p => {
          console.log(`     - ${p.policyname} (${p.cmd})`);
        });
      } else {
        console.log(`   No policies found`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkRLSStatus();
