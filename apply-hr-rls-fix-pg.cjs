#!/usr/bin/env node

/**
 * Apply HR RLS Fix Migration - Direct PostgreSQL Connection
 * This script applies the comprehensive HR RLS fix using direct PostgreSQL connection
 */

const { Pool } = require('pg');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Error: DATABASE_URL must be set in .env.local');
  process.exit(1);
}

console.log('Connecting to PostgreSQL...');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

// SQL statements to execute
const statements = [
  // HR_EMPLOYEES - Drop policies
  `DROP POLICY IF EXISTS "Users can view own employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Users can insert own employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Users can update own employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Users can delete own employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Super admin can view all employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Super admin can insert all employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Super admin can update all employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Super admin can delete all employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Authorized users can read employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Authorized users can insert employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Authorized users can update employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Authorized users can delete employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Users can read own employee record" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Admins can read all employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Admins can manage employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "anon can view hr_employees" ON public.hr_employees`,
  `DROP POLICY IF EXISTS "Super admin bypass for hr_employees" ON public.hr_employees`,
  
  // HR_EMPLOYEES - Enable RLS
  `ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.hr_employees FORCE ROW LEVEL SECURITY`,
  
  // HR_EMPLOYEES - Create policies
  `CREATE POLICY "Users can view own hr_employees" ON public.hr_employees FOR SELECT TO authenticated USING (auth.uid()::text = user_id::text)`,
  `CREATE POLICY "Users can insert own hr_employees" ON public.hr_employees FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id::text)`,
  `CREATE POLICY "Users can update own hr_employees" ON public.hr_employees FOR UPDATE TO authenticated USING (auth.uid()::text = user_id::text) WITH CHECK (auth.uid()::text = user_id::text)`,
  `CREATE POLICY "Users can delete own hr_employees" ON public.hr_employees FOR DELETE TO authenticated USING (auth.uid()::text = user_id::text)`,
  
  // HR_ABSENCE_RECORDS - Drop policies
  `DROP POLICY IF EXISTS "Users can view their own hr_absence_records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Users can insert their own hr_absence_records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Users can update their own hr_absence_records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Users can delete their own hr_absence_records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "anon can view hr_absence_records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "anon can insert hr_absence_records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "anon can update hr_absence_records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "anon can delete hr_absence_records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Super admin can view all absence records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Super admin can insert absence records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Super admin can update absence records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Super admin can delete absence records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Super admin bypass for hr_absence_records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Users can view own absence records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Users can insert own absence records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Users can update own absence records" ON public.hr_absence_records`,
  `DROP POLICY IF EXISTS "Users can delete own absence records" ON public.hr_absence_records`,
  
  // HR_ABSENCE_RECORDS - Enable RLS
  `ALTER TABLE public.hr_absence_records ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.hr_absence_records FORCE ROW LEVEL SECURITY`,
  
  // HR_ABSENCE_RECORDS - Create policies
  `CREATE POLICY "Users can view own hr_absence_records" ON public.hr_absence_records FOR SELECT TO authenticated USING (auth.uid()::text = user_id::text)`,
  `CREATE POLICY "Users can insert own hr_absence_records" ON public.hr_absence_records FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id::text)`,
  `CREATE POLICY "Users can update own hr_absence_records" ON public.hr_absence_records FOR UPDATE TO authenticated USING (auth.uid()::text = user_id::text) WITH CHECK (auth.uid()::text = user_id::text)`,
  `CREATE POLICY "Users can delete own hr_absence_records" ON public.hr_absence_records FOR DELETE TO authenticated USING (auth.uid()::text = user_id::text)`,
  
  // Table grants
  `REVOKE ALL ON TABLE public.hr_employees FROM anon, public`,
  `REVOKE ALL ON TABLE public.hr_absence_records FROM anon, public`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hr_employees TO authenticated`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hr_absence_records TO authenticated`,
];

async function applyMigration() {
  const client = await pool.connect();
  
  console.log('='.repeat(60));
  console.log('Applying HR RLS Fix Migration');
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
      
      // Small delay to avoid overwhelming the connection
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
      console.log('HR RLS policies have been cleaned and fixed.');
      console.log('Users can now manage their own employees and absence records.');
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
