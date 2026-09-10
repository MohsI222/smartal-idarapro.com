-- ============================================
-- Temporary Fix: Disable RLS for Super Admin Access
-- ============================================
-- This migration temporarily disables RLS to restore super admin functionality
-- while we implement a proper long-term solution for the ID mismatch issue
-- ============================================

-- Disable RLS temporarily for critical tables
ALTER TABLE public.hr_employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_reports DISABLE ROW LEVEL SECURITY;

-- Note: This is a temporary measure. A proper solution will be implemented
-- to handle the auth.users ID vs users table ID mismatch
