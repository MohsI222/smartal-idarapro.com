-- ============================================
-- Clean hr_employees Policies Migration
-- ============================================
-- This migration removes all conflicting policies on hr_employees
-- and enforces strict user isolation with super admin override
-- ============================================

-- Drop ALL existing policies on hr_employees
DROP POLICY IF EXISTS "Allow all hr_employees access" ON public.hr_employees;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.hr_employees;
DROP POLICY IF EXISTS "Allow authenticated access for hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Allow authenticated access to hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Allow authenticated delete hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Allow authenticated insert hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Allow authenticated select hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Allow authenticated update hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Allow full access for authenticated users on hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Allow full access to employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Allow full access to hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Authenticated users can manage hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Enable all access for authenticated users on hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Secure access to hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Tenant isolation for hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can delete own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can insert own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can manage employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can update own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can view own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can delete all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can insert all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can update all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can view all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can read own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can insert own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can update own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can delete own employees" ON public.hr_employees;

-- Ensure RLS is enabled and forced
ALTER TABLE public.hr_employees FORCE ROW LEVEL SECURITY;

-- Create strict user isolation policies
CREATE POLICY "Users can view own employees"
  ON public.hr_employees FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own employees"
  ON public.hr_employees FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own employees"
  ON public.hr_employees FOR UPDATE
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own employees"
  ON public.hr_employees FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- Create super admin policies
CREATE POLICY "Super admin can view all employees"
  ON public.hr_employees FOR SELECT
  USING (is_super_admin());

CREATE POLICY "Super admin can insert all employees"
  ON public.hr_employees FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admin can update all employees"
  ON public.hr_employees FOR UPDATE
  USING (is_super_admin());

CREATE POLICY "Super admin can delete all employees"
  ON public.hr_employees FOR DELETE
  USING (is_super_admin());

-- Revoke public access
REVOKE ALL ON TABLE public.hr_employees FROM anon, public;

-- Grant authenticated access
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hr_employees TO authenticated;

-- Add comment
COMMENT ON TABLE public.hr_employees IS 'HR employee records with strict user isolation - users can only see their own employees, super admin can see all';
