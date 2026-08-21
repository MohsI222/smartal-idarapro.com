-- Fix Supabase Security Advisor Warnings and Errors
-- This addresses SECURITY DEFINER function security issues

-- ============================================
-- FIX 1: Revoke EXECUTE from anon for SECURITY DEFINER functions
-- ============================================

-- is_super_admin function - should not be accessible to anon
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon;

-- get_users_with_permissions function - should not be accessible to anon
REVOKE EXECUTE ON FUNCTION public.get_users_with_permissions() FROM anon;

-- is_admin_user function - should not be accessible to anon
REVOKE EXECUTE ON FUNCTION public.is_admin_user() FROM anon;

-- ============================================
-- FIX 2: Ensure SECURITY DEFINER functions have proper search_path
-- ============================================

-- Recreate is_super_admin with explicit search_path for security
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate get_users_with_permissions with explicit search_path
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
SET search_path = public
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

-- Recreate is_admin_user with explicit search_path
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
SECURITY INVOKER
LANGUAGE plpgsql
SET search_path = public
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

-- ============================================
-- FIX 3: Re-grant proper permissions
-- ============================================

-- Grant EXECUTE only to authenticated for is_super_admin
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Grant EXECUTE only to authenticated for get_users_with_permissions
GRANT EXECUTE ON FUNCTION public.get_users_with_permissions() TO authenticated;

-- Grant EXECUTE only to authenticated for is_admin_user
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
