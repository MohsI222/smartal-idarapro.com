-- Drop existing restrictive policies
DROP POLICY IF EXISTS "User_Access_Policy" ON hr_employees;
DROP POLICY IF EXISTS "Users can read own employee record" ON hr_employees;
DROP POLICY IF EXISTS "Admins can read all employees" ON hr_employees;
DROP POLICY IF EXISTS "Admins can manage employees" ON hr_employees;

-- Enable RLS
ALTER TABLE hr_employees ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read all employees
-- This is needed for permissions management where admins need to see all employees
CREATE POLICY "Authenticated users can read all employees"
ON hr_employees FOR SELECT
TO authenticated
USING (true);

-- Create policy to allow authenticated users to insert employees
CREATE POLICY "Authenticated users can insert employees"
ON hr_employees FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create policy to allow authenticated users to update employees
CREATE POLICY "Authenticated users can update employees"
ON hr_employees FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Create policy to allow authenticated users to delete employees
CREATE POLICY "Authenticated users can delete employees"
ON hr_employees FOR DELETE
TO authenticated
USING (true);
