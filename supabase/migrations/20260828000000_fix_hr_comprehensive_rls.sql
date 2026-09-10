-- ============================================
-- Comprehensive HR RLS Fix - Clean and Secure
-- ============================================
-- This migration ensures:
-- 1. Each user can manage their own hr_employees (CRUD)
-- 2. Each user can manage their own hr_absence_records (CRUD)
-- 3. Super admin can manage all data
-- 4. No conflicting policies
-- 5. Proper user isolation
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

-- ============================================
-- 4. VERIFY POLICIES
-- ============================================

SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies 
WHERE tablename IN ('hr_employees', 'hr_absence_records') 
AND schemaname = 'public'
ORDER BY tablename, policyname;

-- Verify table grants
SELECT table_name, grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name IN ('hr_employees', 'hr_absence_records') 
AND table_schema = 'public'
ORDER BY table_name, grantee;
