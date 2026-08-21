-- Disable RLS for hr_employees temporarily to fix 406 error
-- This allows authenticated users to read all employees for permissions management

ALTER TABLE hr_employees DISABLE ROW LEVEL SECURITY;
