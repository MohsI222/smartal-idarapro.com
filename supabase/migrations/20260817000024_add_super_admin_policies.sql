-- ============================================
-- Add Super Admin Policies for Full System Access
-- ============================================
-- This migration adds Super Admin policies to key tables
-- to ensure lahcenm534@gmail.com has unrestricted access
-- Note: Super admin access will be handled at application level
-- to avoid permission errors with is_super_admin() function
-- ============================================

-- Super admin access will be handled in the application layer
-- by checking user email: lahcenm534@gmail.com
-- This avoids permission denied errors from is_super_admin() function

-- No RLS policies needed - application will handle super admin bypass
