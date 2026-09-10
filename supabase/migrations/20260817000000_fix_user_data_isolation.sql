-- ============================================
-- Fix User Data Isolation Migration
-- ============================================
-- This migration ensures strict data isolation between user accounts
-- Each user can only see their own data, except super admin
-- ============================================

-- ============================================
-- 1. FIX SHIFT_REPORTS - CRITICAL SECURITY FIX
-- ============================================

-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Users can view own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can insert own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can update own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can delete own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Super admin can view all shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Super admin can insert all shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Super admin can update all shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Super admin can delete all shift reports" ON public.shift_reports;

-- Create strict user isolation policies
CREATE POLICY "Users can view own shift reports"
  ON public.shift_reports FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own shift reports"
  ON public.shift_reports FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own shift reports"
  ON public.shift_reports FOR UPDATE
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own shift reports"
  ON public.shift_reports FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- ============================================
-- 2. FIX INVENTORY_PRODUCTS - STRICT USER ISOLATION
-- ============================================

-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Authorized users can read inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Authorized users can insert inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Authorized users can update inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Authorized users can delete inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Allow all operations on inventory_products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can view own inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can insert own inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can update own inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can delete own inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Super admin can view all inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Super admin can insert all inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Super admin can update all inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Super admin can delete all inventory products" ON public.inventory_products;

-- Ensure RLS is enabled
ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;

-- Create strict user isolation policies
CREATE POLICY "Users can view own inventory products"
  ON public.inventory_products FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own inventory products"
  ON public.inventory_products FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own inventory products"
  ON public.inventory_products FOR UPDATE
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own inventory products"
  ON public.inventory_products FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- ============================================
-- 3. FIX HR_EMPLOYEES - STRICT USER ISOLATION
-- ============================================

-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Authorized users can read employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Authorized users can insert employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Authorized users can update employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Authorized users can delete employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can read own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can insert own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can update own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can delete own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can view own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can view all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can insert all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can update all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can delete all employees" ON public.hr_employees;

-- Ensure RLS is enabled
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;

-- Create strict user isolation policies
CREATE POLICY "Users can view own employees"
  ON public.hr_employees FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own employees"
  ON public.hr_employees FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own employees"
  ON public.hr_employees FOR UPDATE
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own employees"
  ON public.hr_employees FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- ============================================
-- 4. FIX PERMISSIONS - STRICT USER ISOLATION
-- ============================================

-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Admins can read all permissions" ON public.permissions;
DROP POLICY IF EXISTS "Admins can update all permissions" ON public.permissions;
DROP POLICY IF EXISTS "Admins can insert permissions" ON public.permissions;
DROP POLICY IF EXISTS "Admins can delete permissions" ON public.permissions;
DROP POLICY IF EXISTS "Users can read own permissions" ON public.permissions;
DROP POLICY IF EXISTS "Users can update own permissions" ON public.permissions;
DROP POLICY IF EXISTS "Users can insert own permissions" ON public.permissions;
DROP POLICY IF EXISTS "Users can delete own permissions" ON public.permissions;
DROP POLICY IF EXISTS "Super admin can view all permissions" ON public.permissions;
DROP POLICY IF EXISTS "Super admin can insert permissions" ON public.permissions;
DROP POLICY IF EXISTS "Super admin can update all permissions" ON public.permissions;
DROP POLICY IF EXISTS "Super admin can delete permissions" ON public.permissions;

-- Ensure RLS is enabled
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- Keep only user-specific policies
CREATE POLICY "Users can read own permissions"
  ON public.permissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own permissions"
  ON public.permissions FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- 5. ADD SUPER ADMIN POLICIES FOR ALL TABLES
-- ============================================

-- Super admin function (already exists from auto_real_estate migration)
-- This function checks if the current user is the super admin

-- Add super admin policies for shift_reports
CREATE POLICY "Super admin can view all shift reports"
  ON public.shift_reports FOR SELECT
  USING (is_super_admin());

CREATE POLICY "Super admin can insert all shift reports"
  ON public.shift_reports FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admin can update all shift reports"
  ON public.shift_reports FOR UPDATE
  USING (is_super_admin());

CREATE POLICY "Super admin can delete all shift reports"
  ON public.shift_reports FOR DELETE
  USING (is_super_admin());

-- Add super admin policies for inventory_products
CREATE POLICY "Super admin can view all inventory products"
  ON public.inventory_products FOR SELECT
  USING (is_super_admin());

CREATE POLICY "Super admin can insert all inventory products"
  ON public.inventory_products FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admin can update all inventory products"
  ON public.inventory_products FOR UPDATE
  USING (is_super_admin());

CREATE POLICY "Super admin can delete all inventory products"
  ON public.inventory_products FOR DELETE
  USING (is_super_admin());

-- Add super admin policies for hr_employees
CREATE POLICY "Super admin can view all employees"
  ON public.hr_employees FOR SELECT
  USING (is_super_admin());

CREATE POLICY "Super admin can insert all employees"
  ON public.hr_employees FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admin can update all employees"
  ON public.hr_employees FOR UPDATE
  USING (is_super_admin());

CREATE POLICY "Super admin can delete all employees"
  ON public.hr_employees FOR DELETE
  USING (is_super_admin());

-- Add super admin policies for permissions
CREATE POLICY "Super admin can view all permissions"
  ON public.permissions FOR SELECT
  USING (is_super_admin());

CREATE POLICY "Super admin can insert permissions"
  ON public.permissions FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admin can update all permissions"
  ON public.permissions FOR UPDATE
  USING (is_super_admin());

CREATE POLICY "Super admin can delete permissions"
  ON public.permissions FOR DELETE
  USING (is_super_admin());

-- ============================================
-- 6. UPDATE TABLE COMMENTS
-- ============================================

COMMENT ON TABLE public.shift_reports IS 'Shift reports with strict user isolation - users can only see their own reports, super admin can see all';
COMMENT ON TABLE public.inventory_products IS 'Inventory products with strict user isolation - users can only see their own products, super admin can see all';
COMMENT ON TABLE public.hr_employees IS 'HR employee records with strict user isolation - users can only see their own employees, super admin can see all';
COMMENT ON TABLE public.permissions IS 'User permissions with strict user isolation - users can only see their own permissions, super admin can see all';

-- ============================================
-- 7. ADD SUPER ADMIN POLICIES FOR ADDITIONAL TABLES
-- ============================================

-- Add super admin policies for wedding_invitations (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wedding_invitations') THEN
    DROP POLICY IF EXISTS "Super admin can view all wedding invitations" ON public.wedding_invitations;
    DROP POLICY IF EXISTS "Super admin can insert wedding invitations" ON public.wedding_invitations;
    DROP POLICY IF EXISTS "Super admin can update wedding invitations" ON public.wedding_invitations;
    DROP POLICY IF EXISTS "Super admin can delete wedding invitations" ON public.wedding_invitations;

    CREATE POLICY "Super admin can view all wedding invitations"
      ON public.wedding_invitations FOR SELECT
      USING (is_super_admin());

    CREATE POLICY "Super admin can insert wedding invitations"
      ON public.wedding_invitations FOR INSERT
      WITH CHECK (is_super_admin());

    CREATE POLICY "Super admin can update wedding invitations"
      ON public.wedding_invitations FOR UPDATE
      USING (is_super_admin());

    CREATE POLICY "Super admin can delete wedding invitations"
      ON public.wedding_invitations FOR DELETE
      USING (is_super_admin());
  END IF;
END $$;

-- Add super admin policies for hr_absence_records (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hr_absence_records') THEN
    DROP POLICY IF EXISTS "Super admin can view all absence records" ON public.hr_absence_records;
    DROP POLICY IF EXISTS "Super admin can insert absence records" ON public.hr_absence_records;
    DROP POLICY IF EXISTS "Super admin can update absence records" ON public.hr_absence_records;
    DROP POLICY IF EXISTS "Super admin can delete absence records" ON public.hr_absence_records;

    CREATE POLICY "Super admin can view all absence records"
      ON public.hr_absence_records FOR SELECT
      USING (is_super_admin());

    CREATE POLICY "Super admin can insert absence records"
      ON public.hr_absence_records FOR INSERT
      WITH CHECK (is_super_admin());

    CREATE POLICY "Super admin can update absence records"
      ON public.hr_absence_records FOR UPDATE
      USING (is_super_admin());

    CREATE POLICY "Super admin can delete absence records"
      ON public.hr_absence_records FOR DELETE
      USING (is_super_admin());
  END IF;
END $$;

-- ============================================
-- 8. VERIFY RLS IS ENABLED ON ALL TABLES
-- ============================================

-- Force RLS on core tables
ALTER TABLE public.shift_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employees FORCE ROW LEVEL SECURITY;
ALTER TABLE public.permissions FORCE ROW LEVEL SECURITY;

-- Force RLS on optional tables (if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wedding_invitations') THEN
    ALTER TABLE public.wedding_invitations FORCE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hr_absence_records') THEN
    ALTER TABLE public.hr_absence_records FORCE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Revoke public access from core tables
REVOKE ALL ON TABLE public.shift_reports FROM anon, public;
REVOKE ALL ON TABLE public.inventory_products FROM anon, public;
REVOKE ALL ON TABLE public.hr_employees FROM anon, public;
REVOKE ALL ON TABLE public.permissions FROM anon, public;

-- Revoke public access from optional tables (if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wedding_invitations') THEN
    REVOKE ALL ON TABLE public.wedding_invitations FROM anon, public;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hr_absence_records') THEN
    REVOKE ALL ON TABLE public.hr_absence_records FROM anon, public;
  END IF;
END $$;

-- Grant authenticated access to core tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shift_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hr_employees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.permissions TO authenticated;

-- Grant authenticated access to optional tables (if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wedding_invitations') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wedding_invitations TO authenticated;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hr_absence_records') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hr_absence_records TO authenticated;
  END IF;
END $$;
