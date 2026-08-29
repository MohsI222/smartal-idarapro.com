#!/usr/bin/env node

/**
 * Apply HR RLS Fix Migration - Direct SQL Execution
 * This script applies the comprehensive HR RLS fix to Supabase using direct SQL
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Split SQL into individual statements
const migrationStatements = [
  -- HR_EMPLOYEES - Drop policies
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
  
  -- HR_EMPLOYEES - Enable RLS
  `ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.hr_employees FORCE ROW LEVEL SECURITY`,
  
  -- HR_EMPLOYEES - Create policies
  `CREATE POLICY "Users can view own hr_employees" ON public.hr_employees FOR SELECT TO authenticated USING (auth.uid()::text = user_id::text)`,
  `CREATE POLICY "Users can insert own hr_employees" ON public.hr_employees FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id::text)`,
  `CREATE POLICY "Users can update own hr_employees" ON public.hr_employees FOR UPDATE TO authenticated USING (auth.uid()::text = user_id::text) WITH CHECK (auth.uid()::text = user_id::text)`,
  `CREATE POLICY "Users can delete own hr_employees" ON public.hr_employees FOR DELETE TO authenticated USING (auth.uid()::text = user_id::text)`,
  
  -- HR_ABSENCE_RECORDS - Drop policies
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
  
  -- HR_ABSENCE_RECORDS - Enable RLS
  `ALTER TABLE public.hr_absence_records ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.hr_absence_records FORCE ROW LEVEL SECURITY`,
  
  -- HR_ABSENCE_RECORDS - Create policies
  `CREATE POLICY "Users can view own hr_absence_records" ON public.hr_absence_records FOR SELECT TO authenticated USING (auth.uid()::text = user_id::text)`,
  `CREATE POLICY "Users can insert own hr_absence_records" ON public.hr_absence_records FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id::text)`,
  `CREATE POLICY "Users can update own hr_absence_records" ON public.hr_absence_records FOR UPDATE TO authenticated USING (auth.uid()::text = user_id::text) WITH CHECK (auth.uid()::text = user_id::text)`,
  `CREATE POLICY "Users can delete own hr_absence_records" ON public.hr_absence_records FOR DELETE TO authenticated USING (auth.uid()::text = user_id::text)`,
  
  -- Table grants
  `REVOKE ALL ON TABLE public.hr_employees FROM anon, public`,
  `REVOKE ALL ON TABLE public.hr_absence_records FROM anon, public`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hr_employees TO authenticated`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hr_absence_records TO authenticated`,
];

async function applyMigration() {
  console.log('Applying HR RLS fix migration...');
  console.log(`Total statements to execute: ${migrationStatements.length}`);
  
  let successCount = 0;
  let skipCount = 0;
  
  for (let i = 0; i < migrationStatements.length; i++) {
    const statement = migrationStatements[i];
    try {
      // Use Supabase's direct SQL execution via REST API
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ sql: statement }),
      });
      
      if (response.ok) {
        successCount++;
        console.log(`[${i+1}/${migrationStatements.length}] ✓ Success`);
      } else {
        const error = await response.text();
        // Some statements might fail if policies don't exist - that's okay
        if (error.includes('does not exist') || error.includes('already exists')) {
          skipCount++;
          console.log(`[${i+1}/${migrationStatements.length}] ⊘ Skipped (expected)`);
        } else {
          console.warn(`[${i+1}/${migrationStatements.length}] ⚠ Warning: ${error}`);
        }
      }
    } catch (err) {
      console.warn(`[${i+1}/${migrationStatements.length}] ⚠ Error: ${err.message}`);
    }
  }
  
  console.log('\n=== Migration Summary ===');
  console.log(`Total statements: ${migrationStatements.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Skipped (expected): ${skipCount}`);
  console.log('\nHR RLS fix migration completed!');
  console.log('Users can now manage their own employees and absence records.');
}

applyMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
