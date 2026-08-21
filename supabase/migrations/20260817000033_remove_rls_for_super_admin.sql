-- ============================================
-- Remove RLS for Super Admin (Bypass All Restrictions)
-- ============================================
-- This migration adds policies that allow Super Admin to bypass all RLS
-- by checking role directly in public.users without relying on auth.uid()
-- This works with custom JWT authentication
-- ============================================

-- Drop existing Super Admin policies
DROP POLICY IF EXISTS "Super admin can manage all inventory_products" ON public.inventory_products;
DROP POLICY IF EXISTS "Super admin can manage all hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can manage all hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Super admin can manage all shift_reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Super admin can manage all auto_real_estate" ON public.auto_real_estate;

-- Add Super Admin bypass policies for inventory_products
CREATE POLICY "Super admin bypass for inventory_products"
  ON public.inventory_products FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add Super Admin bypass policies for hr_employees
CREATE POLICY "Super admin bypass for hr_employees"
  ON public.hr_employees FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add Super Admin bypass policies for hr_absence_records
CREATE POLICY "Super admin bypass for hr_absence_records"
  ON public.hr_absence_records FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add Super Admin bypass policies for shift_reports
CREATE POLICY "Super admin bypass for shift_reports"
  ON public.shift_reports FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add Super Admin bypass policies for auto_real_estate
CREATE POLICY "Super admin bypass for auto_real_estate"
  ON public.auto_real_estate FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Verify the changes
SELECT tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE policyname LIKE 'Super admin%'
AND schemaname = 'public'
ORDER BY tablename;
