-- Fix RLS on auth.users to allow is_super_admin function access
-- The issue is that RLS is enabled on auth.users but has no policies,
-- which prevents SECURITY DEFINER functions from accessing it

-- ============================================
-- SOLUTION: Add RLS policy to allow postgres role access
-- ============================================

-- Add a policy that allows postgres (function owner) to access auth.users
-- This is needed because SECURITY DEFINER functions run as postgres
CREATE POLICY "Allow postgres role to access auth.users"
  ON auth.users FOR ALL
  TO postgres
  USING (true)
  WITH CHECK (true);

-- ============================================
-- ALTERNATIVE: Disable RLS on auth.users (if preferred)
-- Uncomment the following if you prefer to disable RLS on auth.users
-- ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;
-- ============================================

-- ============================================
-- VERIFICATION
-- ============================================

-- Check if policy was created successfully
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
-- FROM pg_policies 
-- WHERE schemaname = 'auth' AND tablename = 'users';
