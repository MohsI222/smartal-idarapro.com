-- ============================================
-- Revoke EXECUTE on SECURITY DEFINER Functions
-- ============================================
-- This migration revokes EXECUTE privileges from anon, PUBLIC, and authenticated
-- on SECURITY DEFINER functions to prevent direct execution via REST API
-- while keeping them available for RLS policies
-- ============================================

-- Revoke EXECUTE on is_super_admin from authenticated
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM authenticated;

-- Revoke EXECUTE on get_users_id from PUBLIC, anon, and authenticated
REVOKE EXECUTE ON FUNCTION public.get_users_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_users_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_users_id() FROM authenticated;

-- Verify the changes
SELECT routine_name, security_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND security_type = 'DEFINER';

SELECT routine_name, grantee, privilege_type 
FROM information_schema.routine_privileges 
WHERE routine_schema = 'public' 
AND routine_name IN ('is_super_admin', 'get_users_id');
