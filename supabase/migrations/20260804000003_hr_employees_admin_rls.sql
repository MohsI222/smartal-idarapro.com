-- Add admin policy for hr_employees to allow admins to read all employees

-- Drop existing policy if it conflicts
DROP POLICY IF EXISTS "User_Access_Policy" ON hr_employees;

-- Create policy for authenticated users to read their own employee record
CREATE POLICY "Users can read own employee record"
ON hr_employees FOR SELECT
TO authenticated
USING (user_id::text = auth.uid()::text);

-- Create policy for admins to read all employees
CREATE POLICY "Admins can read all employees"
ON hr_employees FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.employee_id = hr_employees.id
    AND p.is_admin = true
    AND p.employee_id IN (
      SELECT id FROM hr_employees 
      WHERE hr_employees.user_id::text = auth.uid()::text
    )
  )
);

-- Create policy for admins to insert/update/delete employees
CREATE POLICY "Admins can manage employees"
ON hr_employees FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.employee_id = hr_employees.id
    AND p.is_admin = true
    AND p.employee_id IN (
      SELECT id FROM hr_employees 
      WHERE hr_employees.user_id::text = auth.uid()::text
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.employee_id = hr_employees.id
    AND p.is_admin = true
    AND p.employee_id IN (
      SELECT id FROM hr_employees 
      WHERE hr_employees.user_id::text = auth.uid()::text
    )
  )
);
