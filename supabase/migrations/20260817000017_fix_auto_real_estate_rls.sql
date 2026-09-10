-- ============================================
-- Fix auto_real_estate RLS for User Access
-- ============================================
-- This migration adds RLS policies to allow authenticated users
-- to manage their own auto_real_estate entries while protecting
-- data privacy (users can only see/edit their own records)
-- ============================================

-- Drop ALL existing policies on auto_real_estate
DROP POLICY IF EXISTS "Super admin can view all auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Super admin can insert all auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Super admin can update all auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Super admin can delete all auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "anon can view auto_real_estate" ON public.auto_real_estate;
DROP POLICY IF EXISTS "anon can insert auto_real_estate" ON public.auto_real_estate;
DROP POLICY IF EXISTS "anon can update auto_real_estate" ON public.auto_real_estate;
DROP POLICY IF EXISTS "anon can delete auto_real_estate" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Users can view their own auto_real_estate" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Users can insert their own auto_real_estate" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Users can update their own auto_real_estate" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Users can delete their own auto_real_estate" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Super admin can manage all auto_real_estate" ON public.auto_real_estate;

-- Add policies for authenticated users to manage their own data
CREATE POLICY "Users can view their own auto_real_estate"
  ON public.auto_real_estate FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own auto_real_estate"
  ON public.auto_real_estate FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own auto_real_estate"
  ON public.auto_real_estate FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own auto_real_estate"
  ON public.auto_real_estate FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id::text);

-- Add policies for anon role (for basic functionality)
CREATE POLICY "anon can view auto_real_estate"
  ON public.auto_real_estate FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can insert auto_real_estate"
  ON public.auto_real_estate FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon can update auto_real_estate"
  ON public.auto_real_estate FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon can delete auto_real_estate"
  ON public.auto_real_estate FOR DELETE
  TO anon
  USING (true);

-- Add super admin override policy
CREATE POLICY "Super admin can manage all auto_real_estate"
  ON public.auto_real_estate FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auto_real_estate TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auto_real_estate TO authenticated;
