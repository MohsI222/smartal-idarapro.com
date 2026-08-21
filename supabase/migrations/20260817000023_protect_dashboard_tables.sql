-- ============================================
-- Protect Dashboard Tables - Remove Anon Access
-- ============================================
-- This migration removes anon access from dashboard-related tables
-- to ensure that dashboard data is only visible to authenticated users
-- while maintaining user isolation
-- ============================================

-- Remove anon policies from inventory_products
DROP POLICY IF EXISTS "anon can delete inventory_products" ON public.inventory_products;
DROP POLICY IF EXISTS "anon can insert inventory_products" ON public.inventory_products;
DROP POLICY IF EXISTS "anon can update inventory_products" ON public.inventory_products;
DROP POLICY IF EXISTS "anon can view inventory_products" ON public.inventory_products;

-- Remove anon policies from shift_reports
DROP POLICY IF EXISTS "anon can delete shift_reports" ON public.shift_reports;
DROP POLICY IF EXISTS "anon can insert shift_reports" ON public.shift_reports;
DROP POLICY IF EXISTS "anon can update shift_reports" ON public.shift_reports;
DROP POLICY IF EXISTS "anon can view shift_reports" ON public.shift_reports;

-- Remove anon policies from hr_employees
DROP POLICY IF EXISTS "anon can delete hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "anon can insert hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "anon can update hr_employees" ON public.hr_employees;
DROP POLICY IF EXISTS "anon can view hr_employees" ON public.hr_employees;

-- Remove anon policies from hr_absence_records
DROP POLICY IF EXISTS "anon can view hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "anon can insert hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "anon can update hr_absence_records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "anon can delete hr_absence_records" ON public.hr_absence_records;

-- Verify the changes
SELECT tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE tablename IN ('inventory_products', 'shift_reports', 'hr_employees', 'hr_absence_records') 
AND schemaname = 'public'
ORDER BY tablename, policyname;
