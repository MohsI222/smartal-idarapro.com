-- ============================================
-- Re-enable RLS on hr_employees
-- ============================================
-- This migration re-enables RLS on hr_employees table
-- which was accidentally disabled
-- ============================================

ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;

-- Verify the change
SELECT tablename, relrowsecurity 
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public' 
AND t.tablename = 'hr_employees';
