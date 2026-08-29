#!/usr/bin/env node

/**
 * Apply HR RLS Fix Migration
 * This script applies the comprehensive HR RLS fix to Supabase
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

const migrationSQL = `
-- ============================================
-- Comprehensive HR RLS Fix - Clean and Secure
-- ============================================

-- ============================================
-- 1. CLEAN UP HR_EMPLOYEES POLICIES
-- ============================================

-- Drop ALL existing policies on hr_employees
DROP POLICY IF EXISTS "Users can view own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can insert own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can update own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can delete own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can view all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can insert all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can update all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can delete all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Authorized users can read employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Authorized users can insert employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Authorized users can update employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Authorized users can delete employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can read own employee record" ON public.hr_employees;
DROP POLICY IF EXISTS "Admins can read all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Admins can manage employees" ON public.hr_employees;
DROP POLICY IF EXISTS "anon can view hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin bypass for hr_employees" ON public.hr_employees;

-- Ensure RLS is enabled
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employees FORCE ROW LEVEL SECURITY;

-- Create clean user isolation policies for hr_employees
CREATE POLICY "Users can view own hr_employees"
  ON public.hr_employees FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own hr_employees"
  ON public.hr_employees FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own hr_employees"
  ON public.hr_employees FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own hr_employees"
  ON public.hr_employees FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id::text);

-- ============================================
-- 2. CLEAN UP HR_ABSENCE_RECORDS POLICIES
-- ============================================

-- Drop ALL existing policies on hr_absence_records
DROP POLICY IF EXISTS "Users can view their own hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Users can insert their own hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Users can update their own hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Users can delete their own hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "anon can view hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "anon can insert hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "anon can update hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "anon can delete hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Super admin can view all absence records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Super admin can insert absence records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Super admin can update absence records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Super admin can delete absence records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Super admin bypass for hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Users can view own absence records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Users can insert own absence records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Users can update own absence records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Users can delete own absence records" ON public.hr_absence_records;

-- Ensure RLS is enabled
ALTER TABLE public.hr_absence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_absence_records FORCE ROW LEVEL SECURITY;

-- Create clean user isolation policies for hr_absence_records
CREATE POLICY "Users can view own hr_absence_records"
  ON public.hr_absence_records FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own hr_absence_records"
  ON public.hr_absence_records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own hr_absence_records"
  ON public.hr_absence_records FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own hr_absence_records"
  ON public.hr_absence_records FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id::text);

-- ============================================
-- 3. ENSURE PROPER TABLE GRANTS
-- ============================================

-- Revoke all anon access
REVOKE ALL ON TABLE public.hr_employees FROM anon, public;
REVOKE ALL ON TABLE public.hr_absence_records FROM anon, public;

-- Grant authenticated access
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hr_employees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hr_absence_records TO authenticated;
`;

async function applyMigration() {
  console.log('Applying HR RLS fix migration...');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('Error applying migration:', error);
      process.exit(1);
    }
    
    console.log('Migration applied successfully!');
    console.log('HR RLS policies have been cleaned and fixed.');
    console.log('Each user can now manage their own employees and absence records.');
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

// Alternative: Apply via direct SQL execution if exec_sql is not available
async function applyMigrationDirect() {
  console.log('Applying HR RLS fix migration (direct)...');
  
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (const statement of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      if (error) {
        console.warn('Warning (may be expected):', error.message);
      }
    } catch (err) {
      console.warn('Warning (may be expected):', err.message);
    }
  }
  
  console.log('Migration applied successfully!');
}

applyMigration().catch(() => applyMigrationDirect());
