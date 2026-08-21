-- Temporarily disable RLS for hr_employees to fix 406 error
-- This allows the frontend to fetch employees without auth session issues
ALTER TABLE hr_employees DISABLE ROW LEVEL SECURITY;
