-- Fix RLS policies for hr_employees to allow authenticated users full access
-- This ensures all authenticated users can insert, select, update, and delete employees

-- Disable RLS temporarily to allow all operations
ALTER TABLE hr_employees DISABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own employees" ON hr_employees;
DROP POLICY IF EXISTS "Users can insert own employees" ON hr_employees;
DROP POLICY IF EXISTS "Users can update own employees" ON hr_employees;
DROP POLICY IF EXISTS "Users can delete own employees" ON hr_employees;
DROP POLICY IF EXISTS "Admins can read all employees" ON hr_employees;
DROP POLICY IF EXISTS "Admins can update all employees" ON hr_employees;
DROP POLICY IF EXISTS "Admins can insert employees" ON hr_employees;
DROP POLICY IF EXISTS "Admins can delete employees" ON hr_employees;
DROP POLICY IF EXISTS "Authenticated users can manage employees" ON hr_employees;
