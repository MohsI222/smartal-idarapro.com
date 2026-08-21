-- ============================================
-- Fix Super Admin for Custom JWT Authentication
-- ============================================
-- This migration updates the Super Admin function to work with custom JWT auth
-- by checking the role directly from public.users instead of relying on auth.uid()
-- ============================================

-- Create updated function that checks role from public.users
CREATE OR REPLACE FUNCTION is_current_user_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id text;
  user_role text;
BEGIN
  -- Get the current user ID from auth.uid()
  current_user_id := auth.uid()::text;
  
  -- If no user ID, return false
  IF current_user_id IS NULL OR current_user_id = '' THEN
    RETURN false;
  END IF;
  
  -- Check if this user has superadmin role in public.users
  SELECT role INTO user_role
  FROM public.users
  WHERE id = current_user_id;
  
  -- Return true if user has superadmin role
  RETURN user_role = 'superadmin';
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_current_user_super_admin() TO authenticated;

-- Verify the function
SELECT proname, prosecdef 
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'is_current_user_super_admin'
AND n.nspname = 'public';
