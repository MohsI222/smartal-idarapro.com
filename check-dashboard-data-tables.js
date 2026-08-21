import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkDashboardDataTables() {
  try {
    console.log('🔍 Checking RLS policies on dashboard data tables...\n');
    
    // Tables likely used in dashboard based on the UI
    const dashboardTables = ['orders', 'inventory_products', 'pos_invoices', 'shift_reports', 'hr_employees'];
    
    for (const table of dashboardTables) {
      console.log(`📋 Table: ${table}`);
      
      // Check RLS status
      const { rows: rlsStatus } = await pool.query(
        `SELECT relrowsecurity 
         FROM pg_class c
         JOIN pg_tables t ON t.tablename = c.relname
         WHERE t.schemaname = 'public' 
         AND t.tablename = $1`,
        [table]
      );
      
      if (rlsStatus.length > 0) {
        console.log(`   RLS: ${rlsStatus[0].relrowsecurity ? 'ENABLED' : 'DISABLED'}`);
      }
      
      // Check RLS policies
      const { rows: policies } = await pool.query(
        `SELECT policyname, cmd, roles, qual, with_check 
         FROM pg_policies 
         WHERE tablename = $1 AND schemaname = 'public'`,
        [table]
      );
      
      console.log(`   Policies (${policies.length}):`);
      policies.forEach(p => {
        console.log(`     - ${p.policyname}: ${p.cmd} (${p.roles})`);
        if (p.qual && p.qual !== 'true') console.log(`       USING: ${p.qual}`);
        if (p.with_check && p.with_check !== 'true') console.log(`       WITH CHECK: ${p.with_check}`);
      });
      
      // Check if policies allow public access
      const hasPublicAccess = policies.some(p => 
        (p.qual === 'true' || p.qual === null) && 
        (p.with_check === 'true' || p.with_check === null)
      );
      
      if (hasPublicAccess) {
        console.log(`   ⚠️  WARNING: This table allows public access`);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkDashboardDataTables();
