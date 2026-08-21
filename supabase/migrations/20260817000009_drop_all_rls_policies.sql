-- ============================================
-- Drop All RLS Policies
-- ============================================
-- This migration drops all RLS policies since RLS is disabled
-- to prevent conflicts with Supabase client
-- ============================================

-- Drop all hr_employees policies
DROP POLICY IF EXISTS "Super admin can delete all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can insert all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can update all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can view all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can delete own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can insert own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can update own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can view own employees" ON public.hr_employees;

-- Drop all inventory_products policies
DROP POLICY IF EXISTS "Super admin can delete all inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Super admin can insert all inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Super admin can update all inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Super admin can view all inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can delete own inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can insert own inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can update own inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can view own inventory products" ON public.inventory_products;

-- Drop all shift_reports policies
DROP POLICY IF EXISTS "Super admin can delete all shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Super admin can insert all shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Super admin can update all shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Super admin can view all shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can delete own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can insert own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can update own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can view own shift reports" ON public.shift_reports;
