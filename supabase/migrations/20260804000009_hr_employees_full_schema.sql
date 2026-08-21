-- Complete hr_employees table schema with all fields and flexible RLS policies
-- This migration ensures the table has all fields used in the HR module UI

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own employees" ON hr_employees;
DROP POLICY IF EXISTS "Users can insert own employees" ON hr_employees;
DROP POLICY IF EXISTS "Users can update own employees" ON hr_employees;
DROP POLICY IF EXISTS "Users can delete own employees" ON hr_employees;
DROP POLICY IF EXISTS "Admins can read all employees in organization" ON hr_employees;
DROP POLICY IF EXISTS "Admins can update all employees in organization" ON hr_employees;
DROP POLICY IF EXISTS "Admins can insert employees in organization" ON hr_employees;
DROP POLICY IF EXISTS "Admins can delete employees in organization" ON hr_employees;

-- Ensure table exists with all required columns
CREATE TABLE IF NOT EXISTS hr_employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  national_id TEXT,
  employee_id TEXT UNIQUE,
  work_number TEXT,
  role TEXT,
  salary NUMERIC DEFAULT 0,
  contract_type TEXT DEFAULT 'CDI',
  contract_end DATE,
  start_date DATE,
  birth_date DATE,
  marital_status TEXT,
  uniform_color TEXT,
  city TEXT,
  address TEXT,
  rib TEXT,
  bank_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist (for existing tables)
DO $$
BEGIN
  -- Add columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hr_employees' AND column_name = 'user_id') THEN
    ALTER TABLE hr_employees ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hr_employees' AND column_name = 'national_id') THEN
    ALTER TABLE hr_employees ADD COLUMN national_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hr_employees' AND column_name = 'work_number') THEN
    ALTER TABLE hr_employees ADD COLUMN work_number TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hr_employees' AND column_name = 'role') THEN
    ALTER TABLE hr_employees ADD COLUMN role TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hr_employees' AND column_name = 'salary') THEN
    ALTER TABLE hr_employees ADD COLUMN salary NUMERIC DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hr_employees' AND column_name = 'contract_type') THEN
    ALTER TABLE hr_employees ADD COLUMN contract_type TEXT DEFAULT 'CDI';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hr_employees' AND column_name = 'contract_end') THEN
    ALTER TABLE hr_employees ADD COLUMN contract_end DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hr_employees' AND column_name = 'start_date') THEN
    ALTER TABLE hr_employees ADD COLUMN start_date DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hr_employees' AND column_name = 'birth_date') THEN
    ALTER TABLE hr_employees ADD COLUMN birth_date DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hr_employees' AND column_name = 'marital_status') THEN
    ALTER TABLE hr_employees ADD COLUMN marital_status TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hr_employees' AND column_name = 'uniform_color') THEN
    ALTER TABLE hr_employees ADD COLUMN uniform_color TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hr_employees' AND column_name = 'city') THEN
    ALTER TABLE hr_employees ADD COLUMN city TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hr_employees' AND column_name = 'address') THEN
    ALTER TABLE hr_employees ADD COLUMN address TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hr_employees' AND column_name = 'rib') THEN
    ALTER TABLE hr_employees ADD COLUMN rib TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hr_employees' AND column_name = 'bank_name') THEN
    ALTER TABLE hr_employees ADD COLUMN bank_name TEXT;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE hr_employees ENABLE ROW LEVEL SECURITY;

-- Flexible RLS Policies for Admin Access

-- Policy: Users can read only their own employees
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

-- Policy: Admins can read all employees (based on permissions table)
CREATE POLICY "Admins can read all employees"
ON hr_employees FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.employee_id::text = auth.uid()::text
    AND p.is_admin = true
  )
  OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
);

-- Policy: Admins can update all employees
CREATE POLICY "Admins can update all employees"
ON hr_employees FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.employee_id::text = auth.uid()::text
    AND p.is_admin = true
  )
  OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.employee_id::text = auth.uid()::text
    AND p.is_admin = true
  )
  OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
);

-- Policy: Admins can insert employees
CREATE POLICY "Admins can insert employees"
ON hr_employees FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.employee_id::text = auth.uid()::text
    AND p.is_admin = true
  )
  OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
);

-- Policy: Admins can delete employees
CREATE POLICY "Admins can delete employees"
ON hr_employees FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.employee_id::text = auth.uid()::text
    AND p.is_admin = true
  )
  OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_hr_employees_user_id ON hr_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_employee_id ON hr_employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_name ON hr_employees(name);

-- Enable realtime for hr_employees (conditional check to prevent error if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'hr_employees'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE hr_employees;
  END IF;
END $$;

-- Comment on table
COMMENT ON TABLE hr_employees IS 'HR employee records with flexible RLS policies for admin access';
