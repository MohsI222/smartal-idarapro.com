-- ============================================
-- Enable RLS on hr_employees Table
-- ============================================
-- This migration re-enables RLS on hr_employees table
-- which is currently disabled (security risk)
-- ============================================

-- Enable RLS on hr_employees
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;

-- Verify RLS is enabled
SELECT 
  relname as table_name, 
  relrowsecurity as rls_enabled 
FROM pg_class 
WHERE relname = 'hr_employees' 
AND relnamespace = 'public'::regnamespace;
