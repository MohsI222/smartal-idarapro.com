-- ============================================
-- Fix RLS Policies to Use Email-Based Authentication
-- ============================================
-- This migration updates RLS policies to use email-based authentication instead of user_id
-- to handle the mismatch between auth.users ID and users table ID
-- ============================================

-- Drop existing policies on hr_employees
DROP POLICY IF EXISTS "Super admin can delete all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can insert all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can update all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Super admin can view all employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can delete own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can insert own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can update own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can view own employees" ON public.hr_employees;

-- Drop existing policies on inventory_products
DROP POLICY IF EXISTS "Super admin can delete all inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Super admin can insert all inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Super admin can update all inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Super admin can view all inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can delete own inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can insert own inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can update own inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can view own inventory products" ON public.inventory_products;

-- Drop existing policies on shift_reports
DROP POLICY IF EXISTS "Super admin can delete all shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Super admin can insert all shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Super admin can update all shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Super admin can view all shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can delete own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can insert own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can update own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can view own shift reports" ON public.shift_reports;

-- ============================================
-- Create email-based policies for hr_employees
-- ============================================

-- Super admin can view all employees
CREATE POLICY "Super admin can view all employees"
  ON public.hr_employees FOR SELECT
  USING (is_super_admin());

-- Super admin can insert employees
CREATE POLICY "Super admin can insert all employees"
  ON public.hr_employees FOR INSERT
  WITH CHECK (is_super_admin());

-- Super admin can update all employees
CREATE POLICY "Super admin can update all employees"
  ON public.hr_employees FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super admin can delete all employees
CREATE POLICY "Super admin can delete all employees"
  ON public.hr_employees FOR DELETE
  USING (is_super_admin());

-- Users can view their own employees (based on email)
CREATE POLICY "Users can view own employees"
  ON public.hr_employees FOR SELECT
  USING (
    hr_employees.user_id::text = auth.uid()::text
    OR
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id::text = hr_employees.user_id::text
        AND LOWER(u.email) = LOWER(au.email)
      )
    )
  );

-- Users can insert their own employees
CREATE POLICY "Users can insert own employees"
  ON public.hr_employees FOR INSERT
  WITH CHECK (
    hr_employees.user_id::text = auth.uid()::text
    OR
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id::text = hr_employees.user_id::text
        AND LOWER(u.email) = LOWER(au.email)
      )
    )
  );

-- Users can update their own employees
CREATE POLICY "Users can update own employees"
  ON public.hr_employees FOR UPDATE
  USING (
    hr_employees.user_id::text = auth.uid()::text
    OR
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id::text = hr_employees.user_id::text
        AND LOWER(u.email) = LOWER(au.email)
      )
    )
  )
  WITH CHECK (
    hr_employees.user_id::text = auth.uid()::text
    OR
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id::text = hr_employees.user_id::text
        AND LOWER(u.email) = LOWER(au.email)
      )
    )
  );

-- Users can delete their own employees
CREATE POLICY "Users can delete own employees"
  ON public.hr_employees FOR DELETE
  USING (
    hr_employees.user_id::text = auth.uid()::text
    OR
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id::text = hr_employees.user_id::text
        AND LOWER(u.email) = LOWER(au.email)
      )
    )
  );

-- ============================================
-- Create email-based policies for inventory_products
-- ============================================

-- Super admin can view all inventory products
CREATE POLICY "Super admin can view all inventory products"
  ON public.inventory_products FOR SELECT
  USING (is_super_admin());

-- Super admin can insert inventory products
CREATE POLICY "Super admin can insert all inventory products"
  ON public.inventory_products FOR INSERT
  WITH CHECK (is_super_admin());

-- Super admin can update all inventory products
CREATE POLICY "Super admin can update all inventory products"
  ON public.inventory_products FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super admin can delete all inventory products
CREATE POLICY "Super admin can delete all inventory products"
  ON public.inventory_products FOR DELETE
  USING (is_super_admin());

-- Users can view their own inventory products
CREATE POLICY "Users can view own inventory products"
  ON public.inventory_products FOR SELECT
  USING (
    inventory_products.user_id::text = auth.uid()::text
    OR
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id::text = inventory_products.user_id::text
        AND LOWER(u.email) = LOWER(au.email)
      )
    )
  );

-- Users can insert their own inventory products
CREATE POLICY "Users can insert own inventory products"
  ON public.inventory_products FOR INSERT
  WITH CHECK (
    inventory_products.user_id::text = auth.uid()::text
    OR
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id::text = inventory_products.user_id::text
        AND LOWER(u.email) = LOWER(au.email)
      )
    )
  );

-- Users can update their own inventory products
CREATE POLICY "Users can update own inventory products"
  ON public.inventory_products FOR UPDATE
  USING (
    inventory_products.user_id::text = auth.uid()::text
    OR
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id::text = inventory_products.user_id::text
        AND LOWER(u.email) = LOWER(au.email)
      )
    )
  )
  WITH CHECK (
    inventory_products.user_id::text = auth.uid()::text
    OR
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id::text = inventory_products.user_id::text
        AND LOWER(u.email) = LOWER(au.email)
      )
    )
  );

-- Users can delete their own inventory products
CREATE POLICY "Users can delete own inventory products"
  ON public.inventory_products FOR DELETE
  USING (
    inventory_products.user_id::text = auth.uid()::text
    OR
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id::text = inventory_products.user_id::text
        AND LOWER(u.email) = LOWER(au.email)
      )
    )
  );

-- ============================================
-- Create email-based policies for shift_reports
-- ============================================

-- Super admin can view all shift reports
CREATE POLICY "Super admin can view all shift reports"
  ON public.shift_reports FOR SELECT
  USING (is_super_admin());

-- Super admin can insert shift reports
CREATE POLICY "Super admin can insert all shift reports"
  ON public.shift_reports FOR INSERT
  WITH CHECK (is_super_admin());

-- Super admin can update all shift reports
CREATE POLICY "Super admin can update all shift reports"
  ON public.shift_reports FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super admin can delete all shift reports
CREATE POLICY "Super admin can delete all shift reports"
  ON public.shift_reports FOR DELETE
  USING (is_super_admin());

-- Users can view their own shift reports
CREATE POLICY "Users can view own shift reports"
  ON public.shift_reports FOR SELECT
  USING (
    shift_reports.user_id::text = auth.uid()::text
    OR
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id::text = shift_reports.user_id::text
        AND LOWER(u.email) = LOWER(au.email)
      )
    )
  );

-- Users can insert their own shift reports
CREATE POLICY "Users can insert own shift reports"
  ON public.shift_reports FOR INSERT
  WITH CHECK (
    shift_reports.user_id::text = auth.uid()::text
    OR
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id::text = shift_reports.user_id::text
        AND LOWER(u.email) = LOWER(au.email)
      )
    )
  );

-- Users can update their own shift reports
CREATE POLICY "Users can update own shift reports"
  ON public.shift_reports FOR UPDATE
  USING (
    shift_reports.user_id::text = auth.uid()::text
    OR
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id::text = shift_reports.user_id::text
        AND LOWER(u.email) = LOWER(au.email)
      )
    )
  )
  WITH CHECK (
    shift_reports.user_id::text = auth.uid()::text
    OR
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id::text = shift_reports.user_id::text
        AND LOWER(u.email) = LOWER(au.email)
      )
    )
  );

-- Users can delete their own shift reports
CREATE POLICY "Users can delete own shift reports"
  ON public.shift_reports FOR DELETE
  USING (
    shift_reports.user_id::text = auth.uid()::text
    OR
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id::text = shift_reports.user_id::text
        AND LOWER(u.email) = LOWER(au.email)
      )
    )
  );
