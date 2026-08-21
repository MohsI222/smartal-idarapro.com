const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixShiftReportsAccess() {
  try {
    console.log('🔧 Fixing shift_reports access to match inventory_products...\n');
    
    // Check if RLS is enabled
    const rlsStatus = await pool.query(`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relname = 'shift_reports'
    `);
    
    console.log('📋 Current RLS status:', rlsStatus.rows[0]);
    
    // Get current policies
    const policies = await pool.query(`
      SELECT policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies 
      WHERE tablename = 'shift_reports'
    `);
    
    console.log(`\n📋 Current policies (${policies.rows.length}):`);
    policies.rows.forEach((p, i) => {
      console.log(`${i + 1}. ${p.policyname}`);
      console.log(`   Command: ${p.cmd}`);
      console.log(`   Roles: ${p.roles}`);
      console.log(`   Using: ${p.qual}`);
      console.log(`   With Check: ${p.with_check}`);
    });
    
    // Drop all existing policies
    console.log('\n🗑️  Dropping all existing policies...');
    for (const policy of policies.rows) {
      await pool.query(`DROP POLICY IF EXISTS "${policy.policyname}" ON shift_reports`);
      console.log(`✅ Dropped: ${policy.policyname}`);
    }
    
    // Create new policies that match inventory_products
    console.log('\n📝 Creating new policies matching inventory_products...');
    
    await pool.query(`
      CREATE POLICY "Users can view shift_reports with user_id"
      ON shift_reports FOR SELECT
      TO anon, authenticated
      USING (true);
    `);
    console.log('✅ Created SELECT policy');
    
    await pool.query(`
      CREATE POLICY "Users can insert shift_reports with user_id"
      ON shift_reports FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
    `);
    console.log('✅ Created INSERT policy');
    
    await pool.query(`
      CREATE POLICY "Users can update shift_reports"
      ON shift_reports FOR UPDATE
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
    `);
    console.log('✅ Created UPDATE policy');
    
    await pool.query(`
      CREATE POLICY "Users can delete shift_reports"
      ON shift_reports FOR DELETE
      TO anon, authenticated
      USING (true);
    `);
    console.log('✅ Created DELETE policy');
    
    console.log('\n✅ Shift reports policies updated to match inventory_products');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
fixShiftReportsAccess();
