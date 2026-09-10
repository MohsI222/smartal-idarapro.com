-- ============================================
-- Enable RLS on hr_employees
-- ============================================
-- This migration ensures RLS is enabled on hr_employees
-- ============================================

ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;

-- Verify the change
SELECT tablename, relrowsecurity 
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public' 
AND t.tablename = 'hr_employees';
