import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function applyMigration() {
  try {
    console.log('📝 Applying hr_absence_records policies for regular users...\n');
    
    // First, drop the policies if they exist to avoid conflicts
    await pool.query('DROP POLICY IF EXISTS "Users can view own hr_absence_records" ON public.hr_absence_records');
    await pool.query('DROP POLICY IF EXISTS "Users can insert own hr_absence_records" ON public.hr_absence_records');
    await pool.query('DROP POLICY IF EXISTS "Users can update own hr_absence_records" ON public.hr_absence_records');
    await pool.query('DROP POLICY IF EXISTS "Users can delete own hr_absence_records" ON public.hr_absence_records');
    
    console.log('✅ Dropped existing policies (if any)\n');
    
    // Create new policies
    await pool.query(`
CREATE POLICY "Users can view own hr_absence_records"
  ON public.hr_absence_records FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);
`);
    
    console.log('✅ Created SELECT policy');
    
    await pool.query(`
CREATE POLICY "Users can insert own hr_absence_records"
  ON public.hr_absence_records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);
`);
    
    console.log('✅ Created INSERT policy');
    
    await pool.query(`
CREATE POLICY "Users can update own hr_absence_records"
  ON public.hr_absence_records FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);
`);
    
    console.log('✅ Created UPDATE policy');
    
    await pool.query(`
CREATE POLICY "Users can delete own hr_absence_records"
  ON public.hr_absence_records FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id::text);
`);
    
    console.log('✅ Created DELETE policy');
    console.log('\n✅ All policies applied successfully!\n');
    
    const { rows: policies } = await pool.query(`
      SELECT policyname, cmd, roles 
      FROM pg_policies 
      WHERE tablename = 'hr_absence_records' AND schemaname = 'public'
      ORDER BY policyname
    `);
    
    console.log('Current policies on hr_absence_records:');
    policies.forEach(p => {
      console.log(`📋 ${p.policyname} - ${p.cmd} - ${p.roles}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

applyMigration();
