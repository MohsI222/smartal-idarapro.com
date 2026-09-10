-- Add employee_id column to permissions table
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS employee_id text;

-- Create index on employee_id for faster queries
CREATE INDEX IF NOT EXISTS idx_permissions_employee_id ON permissions(employee_id);

-- Update existing permissions to link with hr_employees
-- This maps user_id to the corresponding employee_id from hr_employees
-- Cast user_id::text to handle UUID comparison
UPDATE permissions p
SET employee_id = (
  SELECT id FROM hr_employees 
  WHERE hr_employees.user_id::text = p.user_id::text 
  LIMIT 1
)
WHERE employee_id IS NULL AND user_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN permissions.employee_id IS 'Reference to hr_employees.id for internal employee management';
