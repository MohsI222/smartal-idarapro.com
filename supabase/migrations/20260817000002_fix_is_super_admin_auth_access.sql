-- Fix is_super_admin function to properly access auth.users
-- The function needs explicit permissions to read from auth.users schema

-- ============================================
-- FIX 1: Grant necessary permissions on auth.users
-- ============================================

-- Grant USAGE on auth schema to the function owner (postgres)
-- This allows SECURITY DEFINER functions to access auth.users
GRANT USAGE ON SCHEMA auth TO postgres;

-- Grant SELECT on auth.users to postgres (function owner)
GRANT SELECT ON TABLE auth.users TO postgres;

-- ============================================
-- FIX 2: Recreate is_super_admin function with proper error handling
-- ============================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if current user's email matches super admin email
  -- Uses SECURITY DEFINER to bypass RLS on auth.users
  -- Explicit search_path prevents privilege escalation
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND LOWER(email) = LOWER('lahcenm534@gmail.com')
    AND deleted_at IS NULL
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Return false on any error to prevent blocking
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ============================================
-- FIX 3: Ensure proper permissions
-- ============================================

-- Revoke from anon (security)
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon;

-- Grant to authenticated
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Grant to service_role (for internal operations)
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO service_role;
