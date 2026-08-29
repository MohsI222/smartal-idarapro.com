-- ============================================
-- Fix HR Tables - Enable RLS and Add Anon Policies
-- ============================================
-- This migration enables RLS on hr_employees and adds anon policies
-- to allow basic functionality without user_id restrictions
-- ============================================

-- Enable RLS on hr_employees
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on hr_employees
DROP POLICY IF EXISTS "Users can view their own hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can insert their own hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can update their own hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can delete their own hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "anon can view hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "anon can insert hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "anon can update hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "anon can delete hr_employees" ON public.hr_employees;

-- Create anon policies for hr_employees (allow all operations)
CREATE POLICY "anon can view hr_employees"
  ON public.hr_employees FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can insert hr_employees"
  ON public.hr_employees FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon can update hr_employees"
  ON public.hr_employees FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon can delete hr_employees"
  ON public.hr_employees FOR DELETE
  TO anon
  USING (true);

-- Drop all existing policies on hr_absence_records
DROP POLICY IF EXISTS "Users can view their own hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Users can insert their own hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Users can update their own hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Users can delete their own hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "anon can view hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "anon can insert hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "anon can update hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "anon can delete hr_absence_records" ON public.hr_absence_records;

-- Create anon policies for hr_absence_records (allow all operations)
CREATE POLICY "anon can view hr_absence_records"
  ON public.hr_absence_records FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can insert hr_absence_records"
  ON public.hr_absence_records FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon can update hr_absence_records"
  ON public.hr_absence_records FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon can delete hr_absence_records"
  ON public.hr_absence_records FOR DELETE
  TO anon
  USING (true);

-- Verify the changes
SELECT tablename, relrowsecurity 
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public' 
AND t.tablename IN ('hr_employees', 'hr_absence_records');
