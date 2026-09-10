-- ============================================
-- Fix Super Admin Function Migration
-- ============================================
-- This migration updates the is_super_admin() function to check both auth.users and users table
-- to handle the case where IDs might differ between the two tables
-- ============================================

-- Recreate the function to check both tables (using CREATE OR REPLACE to avoid dependency issues)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Check if current user's email matches super admin email
  -- Check both auth.users and users table to handle ID mismatches
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND LOWER(email) = LOWER('lahcenm534@gmail.com')
    AND deleted_at IS NULL
  ) OR EXISTS (
    SELECT 1 FROM users
    WHERE LOWER(email) = LOWER('lahcenm534@gmail.com')
    AND role = 'superadmin'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Return false on any error to prevent blocking
    RETURN false;
END;
$function$;
