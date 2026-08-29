#!/usr/bin/env node

/**
 * Disable RLS on HR Tables
 * This script disables RLS on hr_employees and hr_absence_records
 * User isolation will be enforced at application level via user_id filters
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

const statements = [
  // Disable RLS on hr_employees
  `ALTER TABLE public.hr_employees DISABLE ROW LEVEL SECURITY`,
  
  // Disable RLS on hr_absence_records
  `ALTER TABLE public.hr_absence_records DISABLE ROW LEVEL SECURITY`,
  
  // Drop all policies (they won't be used with RLS disabled)
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
];

async function applyMigration() {
  const client = await pool.connect();
  
  console.log('='.repeat(60));
  console.log('Disabling RLS on HR Tables');
  console.log('='.repeat(60));
  console.log('User isolation will be enforced at application level');
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
        
        if (errorMsg.includes('does not exist') || errorMsg.includes('already exists')) {
          skipCount++;
          console.log(`[${i+1}/${statements.length}] ⊘ ${shortStmt} (expected)`);
        } else {
          errorCount++;
          console.log(`[${i+1}/${statements.length}] ✗ ${shortStmt}`);
          console.log(`    Error: ${errorMsg}`);
        }
      }
      
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
      console.log('\n✅ RLS disabled successfully!');
      console.log('Users can now manage their employees without RLS restrictions.');
      console.log('User isolation is enforced via user_id filters in the application.');
    } else {
      console.log('\n⚠ Migration completed with some errors.');
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
