-- ============================================
-- Fix HR Tables - Proper RLS with User Isolation and Super Admin Access
-- ============================================
-- This migration creates proper RLS policies:
-- 1. Regular users can manage their own employees (based on user_id)
-- 2. Super admin can manage all employees
-- ============================================

-- Drop all existing policies on hr_employees
DROP POLICY IF EXISTS "Users can view their own hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can insert their own hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can update their own hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can delete their own hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "anon can view hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "anon can insert hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "anon can update hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "anon can delete hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Admins can read all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Admins can update all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Admins can insert employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Admins can delete employees" ON public.hr_employees;

-- Create policies for regular authenticated users (manage their own employees)
CREATE POLICY "Users can view their own hr_employees"
  ON public.hr_employees FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own hr_employees"
  ON public.hr_employees FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own hr_employees"
  ON public.hr_employees FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own hr_employees"
  ON public.hr_employees FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id::text);

-- Create policies for super admin (manage all employees)
CREATE POLICY "Super admin can view all hr_employees"
  ON public.hr_employees FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text
      AND role = 'superadmin'
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  );

CREATE POLICY "Super admin can insert hr_employees"
  ON public.hr_employees FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text
      AND role = 'superadmin'
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  );

CREATE POLICY "Super admin can update hr_employees"
  ON public.hr_employees FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text
      AND role = 'superadmin'
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text
      AND role = 'superadmin'
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  );

CREATE POLICY "Super admin can delete hr_employees"
  ON public.hr_employees FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text
      AND role = 'superadmin'
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  );

-- Drop all existing policies on hr_absence_records
DROP POLICY IF EXISTS "Users can view their own hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Users can insert their own hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Users can update their own hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Users can delete their own hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "anon can view hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "anon can insert hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "anon can update hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "anon can delete hr_absence_records" ON public.hr_absence_records;

-- Create policies for regular authenticated users (manage their own absence records)
CREATE POLICY "Users can view their own hr_absence_records"
  ON public.hr_absence_records FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own hr_absence_records"
  ON public.hr_absence_records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own hr_absence_records"
  ON public.hr_absence_records FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own hr_absence_records"
  ON public.hr_absence_records FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id::text);

-- Create policies for super admin (manage all absence records)
CREATE POLICY "Super admin can view all hr_absence_records"
  ON public.hr_absence_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text
      AND role = 'superadmin'
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  );

CREATE POLICY "Super admin can insert hr_absence_records"
  ON public.hr_absence_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text
      AND role = 'superadmin'
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  );

CREATE POLICY "Super admin can update hr_absence_records"
  ON public.hr_absence_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text
      AND role = 'superadmin'
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text
      AND role = 'superadmin'
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  );

CREATE POLICY "Super admin can delete hr_absence_records"
  ON public.hr_absence_records FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text
      AND role = 'superadmin'
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  );

-- Verify the changes
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename IN ('hr_employees', 'hr_absence_records') 
AND schemaname = 'public'
ORDER BY tablename, policyname;
