-- ============================================
-- Fix Super Admin Function to Check Public Users
-- ============================================
-- This migration updates the Super Admin function to check public.users
-- and allow superadmin role access for custom JWT authentication
-- ============================================

-- Create updated function that checks public.users for Super Admin
CREATE OR REPLACE FUNCTION is_current_user_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid()::text 
    AND (email = 'lahcenm534@gmail.com' OR role = 'superadmin')
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_current_user_super_admin() TO authenticated;

-- Verify the function
SELECT proname, prosecdef 
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'is_current_user_super_admin'
AND n.nspname = 'public';
