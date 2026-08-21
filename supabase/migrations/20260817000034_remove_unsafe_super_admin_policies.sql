-- ============================================
-- Remove Unsafe Super Admin Policies
-- ============================================
-- This migration removes the unsafe USING (true) policies
-- User isolation policies already exist and should remain
-- ============================================

-- Drop unsafe Super Admin bypass policies
DROP POLICY IF EXISTS "Super admin bypass for inventory_products" ON public.inventory_products;
DROP POLICY IF EXISTS "Super admin bypass for hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin bypass for hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Super admin bypass for shift_reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Super admin bypass for auto_real_estate" ON public.auto_real_estate;

-- Verify the changes
SELECT tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE tablename IN ('inventory_products', 'hr_employees', 'hr_absence_records', 'shift_reports')
AND schemaname = 'public'
ORDER BY tablename, policyname;
