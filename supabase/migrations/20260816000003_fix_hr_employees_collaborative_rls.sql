-- Fix RLS policies for hr_employees to enable team collaboration
-- This allows authorized managers and staff to view and manage all employees across the company
-- while maintaining security through the permissions system

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can read own employees" ON hr_employees;
DROP POLICY IF EXISTS "Users can insert own employees" ON hr_employees;
DROP POLICY IF EXISTS "Users can update own employees" ON hr_employees;
DROP POLICY IF EXISTS "Users can delete own employees" ON hr_employees;
DROP POLICY IF EXISTS "Admins can read all employees in organization" ON hr_employees;
DROP POLICY IF EXISTS "Admins can update all employees in organization" ON hr_employees;
DROP POLICY IF EXISTS "Admins can insert employees in organization" ON hr_employees;
DROP POLICY IF EXISTS "Admins can delete employees in organization" ON hr_employees;

-- Enable RLS
ALTER TABLE hr_employees ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users with HR permission can read all employees
CREATE POLICY "Authorized users can read employees"
ON hr_employees FOR SELECT
TO authenticated
USING (
  -- User has can_access_hr permission
  EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.user_id::text = auth.uid()::text
    AND p.can_access_hr = true
  )
);

-- Policy: Authenticated users with HR permission can insert employees
CREATE POLICY "Authorized users can insert employees"
ON hr_employees FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.user_id::text = auth.uid()::text
    AND p.can_access_hr = true
  )
);

-- Policy: Authenticated users with HR permission can update employees
CREATE POLICY "Authorized users can update employees"
ON hr_employees FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.user_id::text = auth.uid()::text
    AND p.can_access_hr = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.user_id::text = auth.uid()::text
    AND p.can_access_hr = true
  )
);

-- Policy: Authenticated users with HR permission can delete employees
CREATE POLICY "Authorized users can delete employees"
ON hr_employees FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.user_id::text = auth.uid()::text
    AND p.can_access_hr = true
  )
);

-- Comment on table
COMMENT ON TABLE hr_employees IS 'HR employee records with collaborative RLS - authorized staff can manage all employees';
