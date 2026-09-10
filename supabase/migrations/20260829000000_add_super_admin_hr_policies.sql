-- ============================================
-- Add Super Admin Policies to HR Tables
-- ============================================
-- This migration adds super admin policies to hr_employees and hr_absence_records
-- The previous migration (20260828000000) removed super admin access
-- ============================================

-- ============================================
-- 1. ADD SUPER ADMIN POLICIES TO HR_EMPLOYEES
-- ============================================

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

-- ============================================
-- 2. ADD SUPER ADMIN POLICIES TO HR_ABSENCE_RECORDS
-- ============================================

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

-- ============================================
-- 3. VERIFY POLICIES
-- ============================================

SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies 
WHERE tablename IN ('hr_employees', 'hr_absence_records') 
AND schemaname = 'public'
ORDER BY tablename, policyname;
