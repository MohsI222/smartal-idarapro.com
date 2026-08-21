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

async function checkAllTablesSecurity() {
  try {
    console.log('🔍 Checking security status of all public tables...\n');

    // Get all public tables
    const tables = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);

    console.log(`📋 Found ${tables.rows.length} tables\n`);

    for (const table of tables.rows) {
      const tableName = table.tablename;
      
      // Check RLS status
      const rlsCheck = await pool.query(`
        SELECT rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = $1
      `, [tableName]);

      const rlsEnabled = rlsCheck.rows[0]?.rowsecurity || false;

      // Check policies
      const policies = await pool.query(`
        SELECT policyname, cmd 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = $1
      `, [tableName]);

      const policyCount = policies.rows.length;

      // Determine security status
      let status = '❌ NOT PROTECTED';
      if (rlsEnabled && policyCount > 0) {
        status = '✅ Protected';
      } else if (rlsEnabled && policyCount === 0) {
        status = '⚠️ RLS enabled but no policies';
      }

      console.log(`📋 ${tableName}:`);
      console.log(`   RLS: ${rlsEnabled}`);
      console.log(`   Policies: ${policyCount}`);
      console.log(`   Status: ${status}`);

      // Show dangerous policies
      for (const policy of policies.rows) {
        if (policy.policyname.toLowerCase().includes('all') || 
            policy.cmd === 'ALL') {
          console.log(`   ⚠️ DANGEROUS POLICY: ${policy.policyname} (${policy.cmd})`);
        }
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAllTablesSecurity();
