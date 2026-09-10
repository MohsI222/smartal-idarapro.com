-- ============================================
-- Add Real Super Admin RLS Policies at Database Level
-- ============================================
-- This migration adds Super Admin policies at the database level
-- to bypass RLS for lahcenm534@gmail.com
-- ============================================

-- Helper function to check if current user is Super Admin by email
CREATE OR REPLACE FUNCTION is_current_user_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'lahcenm534@gmail.com'
  );
$$;

-- Add Super Admin policy to inventory_products
CREATE POLICY "Super admin can manage all inventory_products"
  ON public.inventory_products FOR ALL
  TO authenticated
  USING (is_current_user_super_admin())
  WITH CHECK (is_current_user_super_admin());

-- Add Super Admin policy to hr_employees
CREATE POLICY "Super admin can manage all hr_employees"
  ON public.hr_employees FOR ALL
  TO authenticated
  USING (is_current_user_super_admin())
  WITH CHECK (is_current_user_super_admin());

-- Add Super Admin policy to hr_absence_records
CREATE POLICY "Super admin can manage all hr_absence_records"
  ON public.hr_absence_records FOR ALL
  TO authenticated
  USING (is_current_user_super_admin())
  WITH CHECK (is_current_user_super_admin());

-- Add Super Admin policy to shift_reports
CREATE POLICY "Super admin can manage all shift_reports"
  ON public.shift_reports FOR ALL
  TO authenticated
  USING (is_current_user_super_admin())
  WITH CHECK (is_current_user_super_admin());

-- Add Super Admin policy to auto_real_estate
CREATE POLICY "Super admin can manage all auto_real_estate"
  ON public.auto_real_estate FOR ALL
  TO authenticated
  USING (is_current_user_super_admin())
  WITH CHECK (is_current_user_super_admin());

-- Verify the changes
SELECT tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE policyname LIKE 'Super admin%'
AND schemaname = 'public'
ORDER BY tablename;
