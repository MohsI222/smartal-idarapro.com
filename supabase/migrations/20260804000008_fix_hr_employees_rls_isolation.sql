-- Fix RLS policies for hr_employees to prevent data leakage between accounts
-- This ensures users can only see their own employees, while admins can see all employees in their organization

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can read all employees" ON hr_employees;
DROP POLICY IF EXISTS "Authenticated users can insert employees" ON hr_employees;
DROP POLICY IF EXISTS "Authenticated users can update employees" ON hr_employees;
DROP POLICY IF EXISTS "Authenticated users can delete employees" ON hr_employees;

-- Enable RLS
ALTER TABLE hr_employees ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read only their own employees (where user_id matches auth.uid())
CREATE POLICY "Users can read own employees"
ON hr_employees FOR SELECT
TO authenticated
USING (user_id::text = auth.uid()::text);

-- Policy: Users can insert their own employees
CREATE POLICY "Users can insert own employees"
ON hr_employees FOR INSERT
TO authenticated
WITH CHECK (user_id::text = auth.uid()::text);

-- Policy: Users can update their own employees
CREATE POLICY "Users can update own employees"
ON hr_employees FOR UPDATE
TO authenticated
USING (user_id::text = auth.uid()::text)
WITH CHECK (user_id::text = auth.uid()::text);

-- Policy: Users can delete their own employees
CREATE POLICY "Users can delete own employees"
ON hr_employees FOR DELETE
TO authenticated
USING (user_id::text = auth.uid()::text);

-- Policy: Admins can read all employees in their organization
-- An admin is someone who has is_admin=true in the permissions table
-- and the employee_id in permissions matches an hr_employees record with their user_id
CREATE POLICY "Admins can read all employees in organization"
ON hr_employees FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM permissions p
    JOIN hr_employees he ON p.employee_id = he.id
    WHERE he.user_id::text = auth.uid()::text
    AND p.is_admin = true
  )
);

-- Policy: Admins can update all employees in their organization
CREATE POLICY "Admins can update all employees in organization"
ON hr_employees FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM permissions p
    JOIN hr_employees he ON p.employee_id = he.id
    WHERE he.user_id::text = auth.uid()::text
    AND p.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM permissions p
    JOIN hr_employees he ON p.employee_id = he.id
    WHERE he.user_id::text = auth.uid()::text
    AND p.is_admin = true
  )
);

-- Policy: Admins can insert employees for their organization
CREATE POLICY "Admins can insert employees in organization"
ON hr_employees FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM permissions p
    JOIN hr_employees he ON p.employee_id = he.id
    WHERE he.user_id::text = auth.uid()::text
    AND p.is_admin = true
  )
);

-- Policy: Admins can delete employees in their organization
CREATE POLICY "Admins can delete employees in organization"
ON hr_employees FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM permissions p
    JOIN hr_employees he ON p.employee_id = he.id
    WHERE he.user_id::text = auth.uid()::text
    AND p.is_admin = true
  )
);

-- Comment on table
COMMENT ON TABLE hr_employees IS 'HR employee records with RLS to ensure data isolation between user accounts';
