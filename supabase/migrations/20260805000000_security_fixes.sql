-- Security Fixes Migration
-- This migration addresses all Supabase Security Linter warnings and errors
-- Author: Lahcen El Moutaouakil (lahcenm534@gmail.com)
-- Date: 2026-08-05

-- ============================================
-- FIX 1: Secure auth_users_view
-- ============================================

-- Drop the insecure view and recreate with security_invoker
DROP VIEW IF EXISTS public.auth_users_view CASCADE;

-- Create secure view with security_invoker to prevent privilege escalation
CREATE OR REPLACE VIEW public.auth_users_view
WITH (security_invoker = true) AS
SELECT 
  id,
  email,
  raw_user_meta_data->>'name' as name,
  raw_user_meta_data->>'full_name' as full_name,
  created_at,
  updated_at,
  last_sign_in_at
FROM auth.users
WHERE deleted_at IS NULL;

-- Revoke ALL from anon (public access)
REVOKE ALL ON public.auth_users_view FROM anon;

-- Grant SELECT only to authenticated users
GRANT SELECT ON public.auth_users_view TO authenticated;

-- ============================================
-- FIX 2: Enable RLS on hr_employees table
-- ============================================

ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can insert own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can update own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can delete own employees" ON public.hr_employees;

-- Create secure RLS policies for hr_employees
CREATE POLICY "Users can view own employees"
  ON public.hr_employees FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own employees"
  ON public.hr_employees FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own employees"
  ON public.hr_employees FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own employees"
  ON public.hr_employees FOR DELETE
  USING (auth.uid()::text = user_id);

-- ============================================
-- FIX 3: Enable RLS on permissions table
-- ============================================

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own permissions" ON public.permissions;
DROP POLICY IF EXISTS "Users can insert own permissions" ON public.permissions;
DROP POLICY IF EXISTS "Users can update own permissions" ON public.permissions;
DROP POLICY IF EXISTS "Users can delete own permissions" ON public.permissions;

-- Create secure RLS policies for permissions
CREATE POLICY "Users can view own permissions"
  ON public.permissions FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own permissions"
  ON public.permissions FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own permissions"
  ON public.permissions FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own permissions"
  ON public.permissions FOR DELETE
  USING (auth.uid()::text = user_id);

-- ============================================
-- FIX 4: Secure get_users_with_permissions function
-- ============================================

-- Drop and recreate function with SECURITY INVOKER
DROP FUNCTION IF EXISTS public.get_users_with_permissions() CASCADE;

CREATE OR REPLACE FUNCTION public.get_users_with_permissions()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  name TEXT,
  can_access_inventory BOOLEAN,
  can_access_hr BOOLEAN,
  can_access_delivery BOOLEAN,
  can_access_transport_logistics BOOLEAN,
  can_access_wedding_invitations BOOLEAN,
  can_access_legal BOOLEAN,
  can_access_ai BOOLEAN,
  can_access_settings BOOLEAN,
  is_admin BOOLEAN
) 
SECURITY INVOKER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    u.raw_user_meta_data->>'name' as name,
    COALESCE(p.can_access_inventory, false) as can_access_inventory,
    COALESCE(p.can_access_hr, false) as can_access_hr,
    COALESCE(p.can_access_delivery, false) as can_access_delivery,
    COALESCE(p.can_access_transport_logistics, false) as can_access_transport_logistics,
    COALESCE(p.can_access_wedding_invitations, false) as can_access_wedding_invitations,
    COALESCE(p.can_access_legal, false) as can_access_legal,
    COALESCE(p.can_access_ai, false) as can_access_ai,
    COALESCE(p.can_access_settings, false) as can_access_settings,
    COALESCE(p.is_admin, false) as is_admin
  FROM auth.users u
  LEFT JOIN public.permissions p ON u.id::text = p.user_id::text
  WHERE u.deleted_at IS NULL
  ORDER BY u.created_at DESC;
END;
$$;

-- Revoke from anon, grant to authenticated
REVOKE EXECUTE ON FUNCTION public.get_users_with_permissions() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_users_with_permissions() TO authenticated;

-- ============================================
-- FIX 5: Ensure RLS is enabled on all public tables
-- ============================================

-- Enable RLS on hr_absence_records (already created but ensure it's enabled)
ALTER TABLE public.hr_absence_records ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies for hr_absence_records
DROP POLICY IF EXISTS "Users can view own absence records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Users can insert own absence records" ON public.hr_absence_records;
DROP POLICY IF EXISTS "Users can delete own absence records" ON public.hr_absence_records;

CREATE POLICY "Users can view own absence records"
  ON public.hr_absence_records FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own absence records"
  ON public.hr_absence_records FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own absence records"
  ON public.hr_absence_records FOR DELETE
  USING (auth.uid()::text = user_id);

-- ============================================
-- FIX 6: Revoke anon access from all public tables
-- ============================================

-- Revoke ALL from anon on all public tables
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- Grant SELECT to authenticated on tables that need it
GRANT SELECT ON public.hr_employees TO authenticated;
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT ON public.hr_absence_records TO authenticated;

-- Grant INSERT/UPDATE/DELETE to authenticated on tables that need it
GRANT INSERT, UPDATE, DELETE ON public.hr_employees TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.permissions TO authenticated;
GRANT INSERT, DELETE ON public.hr_absence_records TO authenticated;

-- ============================================
-- FIX 7: Create indexes for performance
-- ============================================

-- Ensure indexes exist for RLS policies
CREATE INDEX IF NOT EXISTS idx_hr_employees_user_id ON public.hr_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_user_id ON public.permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_absence_records_user_id ON public.hr_absence_records(user_id);

-- ============================================
-- FIX 8: Admin access for lahcenm534@gmail.com
-- ============================================

-- Create a function to check if user is admin (lahcenm534@gmail.com)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
SECURITY INVOKER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'lahcenm534@gmail.com'
    AND deleted_at IS NULL
  );
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

-- Create admin bypass policy for hr_employees (only for lahcenm534@gmail.com)
CREATE POLICY "Admin can view all employees"
  ON public.hr_employees FOR SELECT
  USING (public.is_admin_user());

CREATE POLICY "Admin can insert employees for any user"
  ON public.hr_employees FOR INSERT
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admin can update all employees"
  ON public.hr_employees FOR UPDATE
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admin can delete all employees"
  ON public.hr_employees FOR DELETE
  USING (public.is_admin_user());

-- Create admin bypass policy for permissions
CREATE POLICY "Admin can view all permissions"
  ON public.permissions FOR SELECT
  USING (public.is_admin_user());

CREATE POLICY "Admin can manage all permissions"
  ON public.permissions FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Create admin bypass policy for hr_absence_records
CREATE POLICY "Admin can view all absence records"
  ON public.hr_absence_records FOR SELECT
  USING (public.is_admin_user());

CREATE POLICY "Admin can manage all absence records"
  ON public.hr_absence_records FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ============================================
-- Verification Queries (for manual testing)
-- ============================================

-- Check RLS status
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('hr_employees', 'permissions', 'hr_absence_records');

-- Check policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename IN ('hr_employees', 'permissions', 'hr_absence_records');

-- Check grants on auth_users_view
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name = 'auth_users_view';
