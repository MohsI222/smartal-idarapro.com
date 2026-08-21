import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkDashboardTables() {
  try {
    console.log('🔍 Checking dashboard and salary related tables...\n');
    
    // Get all tables
    const { rows: allTables } = await pool.query(
      `SELECT tablename 
       FROM pg_tables 
       WHERE schemaname = 'public'
       ORDER BY tablename`
    );
    
    console.log('All tables in database:');
    allTables.forEach(t => {
      console.log(`  - ${t.tablename}`);
    });
    
    // Look for dashboard-related tables
    const dashboardTables = allTables.filter(t => 
      t.tablename.includes('dashboard') || 
      t.tablename.includes('panel') ||
      t.tablename.includes('control') ||
      t.tablename.includes('board')
    );
    
    console.log('\n📊 Dashboard-related tables:');
    if (dashboardTables.length > 0) {
      dashboardTables.forEach(t => {
        console.log(`  - ${t.tablename}`);
      });
    } else {
      console.log('  No dashboard-related tables found');
    }
    
    // Look for salary-related tables
    const salaryTables = allTables.filter(t => 
      t.tablename.includes('salary') || 
      t.tablename.includes('payroll') ||
      t.tablename.includes('wage') ||
      t.tablename.includes('archive')
    );
    
    console.log('\n💰 Salary-related tables:');
    if (salaryTables.length > 0) {
      salaryTables.forEach(t => {
        console.log(`  - ${t.tablename}`);
      });
    } else {
      console.log('  No salary-related tables found');
    }
    
    // Check RLS status for all tables
    console.log('\n🔒 RLS status for all tables:');
    for (const table of allTables) {
      const { rows: rlsStatus } = await pool.query(
        `SELECT relrowsecurity 
         FROM pg_class c
         JOIN pg_tables t ON t.tablename = c.relname
         WHERE t.schemaname = 'public' 
         AND t.tablename = $1`,
        [table.tablename]
      );
      
      if (rlsStatus.length > 0) {
        const status = rlsStatus[0].relrowsecurity ? '✅' : '❌';
        console.log(`  ${status} ${table.tablename}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkDashboardTables();
