const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixShiftReportsRLS() {
  try {
    console.log('🔧 Fixing shift_reports RLS policies with proper user isolation...\n');
    
    // Drop existing policies
    console.log('🗑️  Dropping existing policies...');
    await pool.query('DROP POLICY IF EXISTS "Authenticated users can delete shift_reports" ON shift_reports');
    await pool.query('DROP POLICY IF EXISTS "Authenticated users can insert shift_reports" ON shift_reports');
    await pool.query('DROP POLICY IF EXISTS "Authenticated users can update shift_reports" ON shift_reports');
    await pool.query('DROP POLICY IF EXISTS "Authenticated users can view shift_reports" ON shift_reports');
    console.log('✅ Dropped existing policies');
    
    // Create new policies with proper user_id checks
    console.log('\n📝 Creating new user-isolated policies...');
    
    // Allow authenticated users to view only their own reports
    await pool.query(`
      CREATE POLICY "Users can view own shift_reports"
      ON shift_reports FOR SELECT
      TO authenticated
      USING (auth.uid()::text = user_id);
    `);
    console.log('✅ Created SELECT policy with user_id check');
    
    // Allow authenticated users to insert only their own reports
    await pool.query(`
      CREATE POLICY "Users can insert own shift_reports"
      ON shift_reports FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid()::text = user_id);
    `);
    console.log('✅ Created INSERT policy with user_id check');
    
    // Allow authenticated users to update only their own reports
    await pool.query(`
      CREATE POLICY "Users can update own shift_reports"
      ON shift_reports FOR UPDATE
      TO authenticated
      USING (auth.uid()::text = user_id)
      WITH CHECK (auth.uid()::text = user_id);
    `);
    console.log('✅ Created UPDATE policy with user_id check');
    
    // Allow authenticated users to delete only their own reports
    await pool.query(`
      CREATE POLICY "Users can delete own shift_reports"
      ON shift_reports FOR DELETE
      TO authenticated
      USING (auth.uid()::text = user_id);
    `);
    console.log('✅ Created DELETE policy with user_id check');
    
    console.log('\n✅ All shift_reports policies created with proper user isolation');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
fixShiftReportsRLS();
