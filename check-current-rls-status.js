import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkCurrentRlsStatus() {
  try {
    console.log('🔍 Checking current RLS policies across all tables...\n');
    
    // Get all tables
    const { rows: allTables } = await pool.query(
      `SELECT tablename 
       FROM pg_tables 
       WHERE schemaname = 'public'
       ORDER BY tablename`
    );
    
    // Check RLS policies for each table
    for (const table of allTables) {
      const { rows: policies } = await pool.query(
        `SELECT policyname, cmd, roles, qual, with_check 
         FROM pg_policies 
         WHERE tablename = $1 AND schemaname = 'public'`,
        [table.tablename]
      );
      
      if (policies.length > 0) {
        console.log(`📋 ${table.tablename} (${policies.length} policies):`);
        policies.forEach(p => {
          console.log(`   - ${p.policyname}: ${p.cmd} (${p.roles})`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkCurrentRlsStatus();
