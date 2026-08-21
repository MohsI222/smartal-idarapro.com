-- Update RLS policies to use employee_id instead of user_id

-- Drop old policies
DROP POLICY IF EXISTS "Users can read own permissions" ON permissions;
DROP POLICY IF EXISTS "Users can update own permissions" ON permissions;
DROP POLICY IF EXISTS "Admins can read all permissions" ON permissions;
DROP POLICY IF EXISTS "Admins can update all permissions" ON permissions;
DROP POLICY IF EXISTS "Admins can insert permissions" ON permissions;
DROP POLICY IF EXISTS "Admins can delete permissions" ON permissions;

-- Create new policies using employee_id

-- Employees can read their own permissions via their hr_employees record
CREATE POLICY "Employees can read own permissions"
ON permissions FOR SELECT
TO authenticated
USING (
  employee_id IN (
    SELECT id FROM hr_employees 
    WHERE hr_employees.user_id::text = auth.uid()::text
  )
);

-- Employees can update their own permissions via their hr_employees record
CREATE POLICY "Employees can update own permissions"
ON permissions FOR UPDATE
TO authenticated
USING (
  employee_id IN (
    SELECT id FROM hr_employees 
    WHERE hr_employees.user_id::text = auth.uid()::text
  )
)
WITH CHECK (
  employee_id IN (
    SELECT id FROM hr_employees 
    WHERE hr_employees.user_id::text = auth.uid()::text
  )
);

-- Admins can read all permissions
CREATE POLICY "Admins can read all permissions"
ON permissions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM permissions p2
    WHERE p2.employee_id IN (
      SELECT id FROM hr_employees 
      WHERE hr_employees.user_id::text = auth.uid()::text
    )
    AND p2.is_admin = true
  )
);

-- Admins can update all permissions
CREATE POLICY "Admins can update all permissions"
ON permissions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM permissions p2
    WHERE p2.employee_id IN (
      SELECT id FROM hr_employees 
      WHERE hr_employees.user_id::text = auth.uid()::text
    )
    AND p2.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM permissions p2
    WHERE p2.employee_id IN (
      SELECT id FROM hr_employees 
      WHERE hr_employees.user_id::text = auth.uid()::text
    )
    AND p2.is_admin = true
  )
);

-- Admins can insert permissions
CREATE POLICY "Admins can insert permissions"
ON permissions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM permissions p2
    WHERE p2.employee_id IN (
      SELECT id FROM hr_employees 
      WHERE hr_employees.user_id::text = auth.uid()::text
    )
    AND p2.is_admin = true
  )
);

-- Admins can delete permissions
CREATE POLICY "Admins can delete permissions"
ON permissions FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM permissions p2
    WHERE p2.employee_id IN (
      SELECT id FROM hr_employees 
      WHERE hr_employees.user_id::text = auth.uid()::text
    )
    AND p2.is_admin = true
  )
);
