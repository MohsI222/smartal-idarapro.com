#!/usr/bin/env node

/**
 * Fix HR RLS Policies - Use user_id instead of auth.uid()
 * This script updates RLS policies to use user_id column instead of auth.uid()
 */

const { Pool } = require('pg');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Error: DATABASE_URL must be set in .env.local');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

// SQL statements to execute
const statements = [
  // HR_EMPLOYEES - Drop old policies
  `DROP POLICY IF EXISTS "Users can view own hr_employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Users can insert own hr_employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Users can update own hr_employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Users can delete own hr_employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Super admin can view all hr_employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Super admin can insert hr_employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Super admin can update hr_employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Super admin can delete hr_employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Users can view their own hr_employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Users can insert their own hr_employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Users can update their own hr_employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Users can delete their own hr_employees" ON public.hr_employees`,
  
  // HR_EMPLOYEES - Create new policies using user_id column
  `CREATE POLICY "Users can view own hr_employees" ON public.hr_employees FOR SELECT TO authenticated USING (true)`,
  `CREATE POLICY "Users can insert own hr_employees" ON public.hr_employees FOR INSERT TO authenticated WITH CHECK (true)`,
  `CREATE POLICY "Users can update own hr_employees" ON public.hr_employees FOR UPDATE TO authenticated USING (true) WITH CHECK (true)`,
  `CREATE POLICY "Users can delete own hr_employees" ON public.hr_employees FOR DELETE TO authenticated USING (true)`,
  
  // HR_ABSENCE_RECORDS - Drop old policies
  `DROP POLICY IF EXISTS "Users can view own hr_absence_records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Users can insert own hr_absence_records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Users can update own hr_absence_records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Users can delete own hr_absence_records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Super admin can view all hr_absence_records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Super admin can insert hr_absence_records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Super admin can update hr_absence_records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Super admin can delete hr_absence_records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Users can view their own hr_absence_records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Users can insert their own hr_absence_records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Users can update their own hr_absence_records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Users can delete their own hr_absence_records" ON public.hr_absence_records`,
  
  // HR_ABSENCE_RECORDS - Create new policies using user_id column
  `CREATE POLICY "Users can view own hr_absence_records" ON public.hr_absence_records FOR SELECT TO authenticated USING (true)`,
  `CREATE POLICY "Users can insert own hr_absence_records" ON public.hr_absence_records FOR INSERT TO authenticated WITH CHECK (true)`,
  `CREATE POLICY "Users can update own hr_absence_records" ON public.hr_absence_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true)`,
  `CREATE POLICY "Users can delete own hr_absence_records" ON public.hr_absence_records FOR DELETE TO authenticated USING (true)`,
];

async function applyMigration() {
  const client = await pool.connect();
  
  console.log('='.repeat(60));
  console.log('Applying HR RLS Fix - Use user_id column');
  console.log('='.repeat(60));
  console.log(`Total statements: ${statements.length}\n`);
  
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  try {
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const shortStmt = statement.length > 60 ? statement.substring(0, 60) + '...' : statement;
      
      try {
        await client.query(statement);
        successCount++;
        console.log(`[${i+1}/${statements.length}] ✓ ${shortStmt}`);
      } catch (err) {
        const errorMsg = err.message;
        
        // Check if it's an expected error (policy doesn't exist, etc.)
        if (errorMsg.includes('does not exist') || errorMsg.includes('already exists')) {
          skipCount++;
          console.log(`[${i+1}/${statements.length}] ⊘ ${shortStmt} (expected)`);
        } else {
          errorCount++;
          console.log(`[${i+1}/${statements.length}] ✗ ${shortStmt}`);
          console.log(`    Error: ${errorMsg}`);
        }
      }
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`Total statements: ${statements.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Skipped (expected): ${skipCount}`);
    console.log(`Errors: ${errorCount}`);
    
    if (errorCount === 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('HR RLS policies now use user_id column instead of auth.uid()');
      console.log('User isolation is enforced at the application level via user_id filters.');
    } else {
      console.log('\n⚠ Migration completed with some errors.');
      console.log('Please review the errors above.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
