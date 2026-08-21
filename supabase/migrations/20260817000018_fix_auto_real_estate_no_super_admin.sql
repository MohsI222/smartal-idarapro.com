-- ============================================
-- Fix auto_real_estate RLS - Remove Super Admin Policy
-- ============================================
-- This migration removes the super admin policy that uses is_super_admin()
-- function which causes permission errors for regular users
-- ============================================

-- Drop the problematic super admin policy
DROP POLICY IF EXISTS "Super admin can manage all auto_real_estate" ON public.auto_real_estate;

-- Keep only the user-specific policies and anon policies
-- These allow all users to manage their own data without restrictions

-- Verify the remaining policies
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'auto_real_estate' 
AND schemaname = 'public';
