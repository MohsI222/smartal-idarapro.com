-- ============================================
-- Add Direct Super Admin RLS Policies (No Function)
-- ============================================
-- This migration adds Super Admin policies that directly check role
-- in public.users without relying on auth.uid() or functions
-- This works with custom JWT authentication
-- ============================================

-- Drop existing Super Admin policies that use the function
DROP POLICY IF EXISTS "Super admin can manage all inventory_products" ON public.inventory_products;
DROP POLICY IF EXISTS "Super admin can manage all hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can manage all hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Super admin can manage all shift_reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Super admin can manage all auto_real_estate" ON public.auto_real_estate;

-- Add direct Super Admin policies for inventory_products
CREATE POLICY "Super admin can manage all inventory_products"
  ON public.inventory_products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()::text 
      AND role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()::text 
      AND role = 'superadmin'
    )
  );

-- Add direct Super Admin policies for hr_employees
CREATE POLICY "Super admin can manage all hr_employees"
  ON public.hr_employees FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()::text 
      AND role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()::text 
      AND role = 'superadmin'
    )
  );

-- Add direct Super Admin policies for hr_absence_records
CREATE POLICY "Super admin can manage all hr_absence_records"
  ON public.hr_absence_records FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()::text 
      AND role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()::text 
      AND role = 'superadmin'
    )
  );

-- Add direct Super Admin policies for shift_reports
CREATE POLICY "Super admin can manage all shift_reports"
  ON public.shift_reports FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()::text 
      AND role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()::text 
      AND role = 'superadmin'
    )
  );

-- Add direct Super Admin policies for auto_real_estate
CREATE POLICY "Super admin can manage all auto_real_estate"
  ON public.auto_real_estate FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()::text 
      AND role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()::text 
      AND role = 'superadmin'
    )
  );

-- Verify the changes
SELECT tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE policyname LIKE 'Super admin%'
AND schemaname = 'public'
ORDER BY tablename;
