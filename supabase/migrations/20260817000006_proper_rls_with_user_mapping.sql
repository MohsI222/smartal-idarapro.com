-- ============================================
-- Proper RLS with User Mapping Function
-- ============================================
-- This migration creates a proper long-term solution for RLS
-- by creating a function that maps auth.users ID to users table ID
-- ============================================

-- Create a function to get the users table ID from auth.users ID
CREATE OR REPLACE FUNCTION public.get_users_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Try direct match first (for users where IDs match)
  DECLARE
    users_id text;
  BEGIN
    SELECT id::text INTO users_id FROM users WHERE id::text = auth.uid()::text;
    IF users_id IS NOT NULL THEN
      RETURN users_id;
    END IF;
    
    -- If no direct match, try email-based mapping
    SELECT u.id::text INTO users_id
    FROM users u
    JOIN auth.users au ON LOWER(u.email) = LOWER(au.email)
    WHERE au.id = auth.uid();
    
    RETURN users_id;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$function$;

-- Update is_super_admin to use the new mapping
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Check if current user's email matches super admin email
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND LOWER(email) = LOWER('lahcenm534@gmail.com')
    AND deleted_at IS NULL
  ) OR EXISTS (
    SELECT 1 FROM users
    WHERE LOWER(email) = LOWER('lahcenm534@gmail.com')
    AND role = 'superadmin'
    AND EXISTS (
      SELECT 1 FROM auth.users au
      WHERE LOWER(au.email) = LOWER(users.email)
      AND au.id = auth.uid()
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$function$;

-- ============================================
-- Re-enable RLS with proper user mapping
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Super admin can delete all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can insert all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can update all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can view all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can delete own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can insert own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can update own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can view own employees" ON public.hr_employees;

DROP POLICY IF EXISTS "Super admin can delete all inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Super admin can insert all inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Super admin can update all inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Super admin can view all inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can delete own inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can insert own inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can update own inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can view own inventory products" ON public.inventory_products;

DROP POLICY IF EXISTS "Super admin can delete all shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Super admin can insert all shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Super admin can update all shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Super admin can view all shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can delete own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can insert own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can update own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can view own shift reports" ON public.shift_reports;

-- ============================================
-- Create proper RLS policies for hr_employees
-- ============================================

-- Super admin policies
CREATE POLICY "Super admin can view all employees"
  ON public.hr_employees FOR SELECT
  USING (is_super_admin());

CREATE POLICY "Super admin can insert all employees"
  ON public.hr_employees FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admin can update all employees"
  ON public.hr_employees FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admin can delete all employees"
  ON public.hr_employees FOR DELETE
  USING (is_super_admin());

-- User policies using get_users_id()
CREATE POLICY "Users can view own employees"
  ON public.hr_employees FOR SELECT
  USING (hr_employees.user_id::text = get_users_id());

CREATE POLICY "Users can insert own employees"
  ON public.hr_employees FOR INSERT
  WITH CHECK (hr_employees.user_id::text = get_users_id());

CREATE POLICY "Users can update own employees"
  ON public.hr_employees FOR UPDATE
  USING (hr_employees.user_id::text = get_users_id())
  WITH CHECK (hr_employees.user_id::text = get_users_id());

CREATE POLICY "Users can delete own employees"
  ON public.hr_employees FOR DELETE
  USING (hr_employees.user_id::text = get_users_id());

-- ============================================
-- Create proper RLS policies for inventory_products
-- ============================================

-- Super admin policies
CREATE POLICY "Super admin can view all inventory products"
  ON public.inventory_products FOR SELECT
  USING (is_super_admin());

CREATE POLICY "Super admin can insert all inventory products"
  ON public.inventory_products FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admin can update all inventory products"
  ON public.inventory_products FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admin can delete all inventory products"
  ON public.inventory_products FOR DELETE
  USING (is_super_admin());

-- User policies using get_users_id()
CREATE POLICY "Users can view own inventory products"
  ON public.inventory_products FOR SELECT
  USING (inventory_products.user_id::text = get_users_id());

CREATE POLICY "Users can insert own inventory products"
  ON public.inventory_products FOR INSERT
  WITH CHECK (inventory_products.user_id::text = get_users_id());

CREATE POLICY "Users can update own inventory products"
  ON public.inventory_products FOR UPDATE
  USING (inventory_products.user_id::text = get_users_id())
  WITH CHECK (inventory_products.user_id::text = get_users_id());

CREATE POLICY "Users can delete own inventory products"
  ON public.inventory_products FOR DELETE
  USING (inventory_products.user_id::text = get_users_id());

-- ============================================
-- Create proper RLS policies for shift_reports
-- ============================================

-- Super admin policies
CREATE POLICY "Super admin can view all shift reports"
  ON public.shift_reports FOR SELECT
  USING (is_super_admin());

CREATE POLICY "Super admin can insert all shift reports"
  ON public.shift_reports FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admin can update all shift reports"
  ON public.shift_reports FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admin can delete all shift reports"
  ON public.shift_reports FOR DELETE
  USING (is_super_admin());

-- User policies using get_users_id()
CREATE POLICY "Users can view own shift reports"
  ON public.shift_reports FOR SELECT
  USING (shift_reports.user_id::text = get_users_id());

CREATE POLICY "Users can insert own shift reports"
  ON public.shift_reports FOR INSERT
  WITH CHECK (shift_reports.user_id::text = get_users_id());

CREATE POLICY "Users can update own shift reports"
  ON public.shift_reports FOR UPDATE
  USING (shift_reports.user_id::text = get_users_id())
  WITH CHECK (shift_reports.user_id::text = get_users_id());

CREATE POLICY "Users can delete own shift reports"
  ON public.shift_reports FOR DELETE
  USING (shift_reports.user_id::text = get_users_id());
