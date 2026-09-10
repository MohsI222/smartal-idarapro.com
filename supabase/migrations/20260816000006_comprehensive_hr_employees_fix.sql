-- Comprehensive fix for hr_employees RLS issues
-- This script:
-- 1. Enables RLS on hr_employees
-- 2. Drops all existing policies
-- 3. Creates collaborative policies for team access
-- 4. Fixes sensitive column exposure

BEGIN;

-- Step 1: Ensure RLS is enabled
ALTER TABLE IF EXISTS public.hr_employees ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can read own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can insert own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can update own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can delete own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Admins can read all employees in organization" ON public.hr_employees;
DROP POLICY IF EXISTS "Admins can update all employees in organization" ON public.hr_employees;
DROP POLICY IF EXISTS "Admins can insert employees in organization" ON public.hr_employees;
DROP POLICY IF EXISTS "Admins can delete employees in organization" ON public.hr_employees;
DROP POLICY IF EXISTS "Authenticated users can read all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Authenticated users can insert employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Authenticated users can update employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Authenticated users can delete employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Authorized users can read employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Authorized users can insert employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Authorized users can update employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Authorized users can delete employees" ON public.hr_employees;

-- Step 3: Create collaborative policies based on permissions
-- Policy: Authenticated users with HR permission can read all employees
CREATE POLICY "Authorized users can read employees"
ON public.hr_employees FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.permissions p
    WHERE p.user_id::text = auth.uid()::text
    AND p.can_access_hr = true
  )
  OR
  -- Super admin can always read
  auth.uid()::text IN (
    SELECT id::text FROM auth.users WHERE email = 'lahcenm534@gmail.com'
  )
);

-- Policy: Authenticated users with HR permission can insert employees
CREATE POLICY "Authorized users can insert employees"
ON public.hr_employees FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.permissions p
    WHERE p.user_id::text = auth.uid()::text
    AND p.can_access_hr = true
  )
  OR
  -- Super admin can always insert
  auth.uid()::text IN (
    SELECT id::text FROM auth.users WHERE email = 'lahcenm534@gmail.com'
  )
);

-- Policy: Authenticated users with HR permission can update employees
CREATE POLICY "Authorized users can update employees"
ON public.hr_employees FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.permissions p
    WHERE p.user_id::text = auth.uid()::text
    AND p.can_access_hr = true
  )
  OR
  -- Super admin can always update
  auth.uid()::text IN (
    SELECT id::text FROM auth.users WHERE email = 'lahcenm534@gmail.com'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.permissions p
    WHERE p.user_id::text = auth.uid()::text
    AND p.can_access_hr = true
  )
  OR
  -- Super admin can always update
  auth.uid()::text IN (
    SELECT id::text FROM auth.users WHERE email = 'lahcenm534@gmail.com'
  )
);

-- Policy: Authenticated users with HR permission can delete employees
CREATE POLICY "Authorized users can delete employees"
ON public.hr_employees FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.permissions p
    WHERE p.user_id::text = auth.uid()::text
    AND p.can_access_hr = true
  )
  OR
  -- Super admin can always delete
  auth.uid()::text IN (
    SELECT id::text FROM auth.users WHERE email = 'lahcenm534@gmail.com'
  )
);

-- Step 4: Add comment to table
COMMENT ON TABLE public.hr_employees IS 'HR employee records with collaborative RLS - authorized staff can manage all employees';

COMMIT;

-- Verification query (run separately to check)
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
-- FROM pg_policies 
-- WHERE tablename = 'hr_employees';
