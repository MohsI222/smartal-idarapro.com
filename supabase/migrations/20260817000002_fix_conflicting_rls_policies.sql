-- ============================================
-- Fix Conflicting RLS Policies Migration
-- ============================================
-- This migration removes ALL conflicting RLS policies on inventory_products and shift_reports
-- and recreates clean, strict user isolation policies with super admin override
-- ============================================

-- Drop ALL existing policies on inventory_products
DROP POLICY IF EXISTS "Allow all inventory access" ON public.inventory_products;
DROP POLICY IF EXISTS "Allow authenticated operations on inventory_products" ON public.inventory_products;
DROP POLICY IF EXISTS "Allow user inventory access" ON public.inventory_products;
DROP POLICY IF EXISTS "Authenticated users can manage inventory_products" ON public.inventory_products;
DROP POLICY IF EXISTS "Tenant isolation for inventory_products" ON public.inventory_products;
DROP POLICY IF EXISTS "User_Access_Policy" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can manage their own inventory" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can delete own inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can insert own inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can update own inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can view own inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Super admin can delete all inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Super admin can insert all inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Super admin can update all inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Super admin can view all inventory products" ON public.inventory_products;

-- Drop ALL existing policies on shift_reports
DROP POLICY IF EXISTS "Allow all shift_reports access" ON public.shift_reports;
DROP POLICY IF EXISTS "Allow users to manage shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Authenticated users can manage shift_reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Secure access to shift_reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can manage their own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can delete own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can insert own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can update own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can view own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Super admin can delete all shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Super admin can insert all shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Super admin can update all shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Super admin can view all shift reports" ON public.shift_reports;

-- ============================================
-- Create clean user isolation policies for inventory_products
-- ============================================

-- Users can view their own inventory products
CREATE POLICY "Users can view own inventory products"
  ON public.inventory_products FOR SELECT
  USING (auth.uid()::text = user_id);

-- Users can insert their own inventory products
CREATE POLICY "Users can insert own inventory products"
  ON public.inventory_products FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own inventory products
CREATE POLICY "Users can update own inventory products"
  ON public.inventory_products FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Users can delete their own inventory products
CREATE POLICY "Users can delete own inventory products"
  ON public.inventory_products FOR DELETE
  USING (auth.uid()::text = user_id);

-- ============================================
-- Create super admin override policies for inventory_products
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

-- ============================================
-- Create clean user isolation policies for shift_reports
-- ============================================

-- Users can view their own shift reports
CREATE POLICY "Users can view own shift reports"
  ON public.shift_reports FOR SELECT
  USING (auth.uid()::text = user_id);

-- Users can insert their own shift reports
CREATE POLICY "Users can insert own shift reports"
  ON public.shift_reports FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own shift reports
CREATE POLICY "Users can update own shift reports"
  ON public.shift_reports FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Users can delete their own shift reports
CREATE POLICY "Users can delete own shift reports"
  ON public.shift_reports FOR DELETE
  USING (auth.uid()::text = user_id);

-- ============================================
-- Create super admin override policies for shift_reports
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

-- ============================================
-- Ensure RLS is enabled and forced
-- ============================================

ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_products FORCE ROW LEVEL SECURITY;

ALTER TABLE public.shift_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_reports FORCE ROW LEVEL SECURITY;

-- ============================================
-- Revoke and re-grant permissions
-- ============================================

REVOKE ALL ON TABLE public.inventory_products FROM anon, public;
REVOKE ALL ON TABLE public.shift_reports FROM anon, public;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shift_reports TO authenticated;
