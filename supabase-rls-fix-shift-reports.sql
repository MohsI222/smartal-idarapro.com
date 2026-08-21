-- Fix RLS Policies for shift_reports table
-- Execute this in Supabase SQL Editor

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow users to read their own shift reports" ON shift_reports;
DROP POLICY IF EXISTS "Allow users to insert their own shift reports" ON shift_reports;
DROP POLICY IF EXISTS "Allow users to update their own shift reports" ON shift_reports;
DROP POLICY IF EXISTS "Allow users to delete their own shift reports" ON shift_reports;

-- Enable RLS if not already enabled
ALTER TABLE shift_reports ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT (Read)
CREATE POLICY "Allow users to read their own shift reports"
ON shift_reports
FOR SELECT
USING (auth.uid()::text = user_id::text);

-- Policy for INSERT (Create)
CREATE POLICY "Allow users to insert their own shift reports"
ON shift_reports
FOR INSERT
WITH CHECK (auth.uid()::text = user_id::text);

-- Policy for UPDATE (Modify)
CREATE POLICY "Allow users to update their own shift reports"
ON shift_reports
FOR UPDATE
USING (auth.uid()::text = user_id::text)
WITH CHECK (auth.uid()::text = user_id::text);

-- Policy for DELETE (Remove)
CREATE POLICY "Allow users to delete their own shift reports"
ON shift_reports
FOR DELETE
USING (auth.uid()::text = user_id::text);
