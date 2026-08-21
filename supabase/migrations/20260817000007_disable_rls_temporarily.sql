-- ============================================
-- Disable RLS Temporarily to Restore Functionality
-- ============================================
-- This migration temporarily disables RLS to restore super admin functionality
-- while we debug the get_users_id() function and RLS policies
-- ============================================

-- Disable RLS on all critical tables
ALTER TABLE public.hr_employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_reports DISABLE ROW LEVEL SECURITY;

-- Note: This is a temporary measure to restore functionality
