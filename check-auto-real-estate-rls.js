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

async function checkAutoRealEstateRLS() {
  try {
    console.log('🔍 Checking auto_real_estate RLS status directly...\n');

    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = 'auto_real_estate'
    `);

    if (tableCheck.rows.length === 0) {
      console.log('❌ Table auto_real_estate does not exist');
      return;
    }

    console.log('✅ Table auto_real_estate exists\n');

    // Check RLS status
    const rlsCheck = await pool.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = 'auto_real_estate'
    `);

    console.log(`📋 RLS Enabled: ${rlsCheck.rows[0].rowsecurity}\n`);

    // Check existing policies
    const policies = await pool.query(`
      SELECT policyname, cmd, qual, with_check
      FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'auto_real_estate'
    `);

    console.log(`📋 Policies (${policies.rows.length}):`);
    policies.rows.forEach(policy => {
      console.log(`   - ${policy.policyname} (${policy.cmd})`);
    });

    if (policies.rows.length === 0) {
      console.log('\n⚠️ No policies found - RLS is enabled but no policies exist');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAutoRealEstateRLS();
