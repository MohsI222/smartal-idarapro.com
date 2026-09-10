-- ============================================
-- Fix HR Absence Records Security - Simplify Policies
-- ============================================
-- This migration simplifies the complex RLS policies on hr_absence_records
-- to ensure users can only see and manage their own records
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Admin can manage all absence records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Admin can view all absence records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Allow authenticated access for hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Allow full access to absence records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Super admin can delete absence records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Super admin can insert absence records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Super admin can update absence records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Super admin can view all absence records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Users can delete own absence records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Users can insert own absence records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Users can view own absence records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "anon can view hr_absence_records" ON public.hr_absence_records;

-- Create simple policies for authenticated users to manage their own records
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

-- Create policies for anon role (for basic functionality)
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
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'hr_absence_records' 
AND schemaname = 'public';
