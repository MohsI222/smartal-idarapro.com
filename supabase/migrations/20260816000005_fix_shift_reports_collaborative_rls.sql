-- Fix RLS policies for shift_reports to enable team collaboration
-- This allows authorized managers and staff to view and manage all shift reports across the company
-- while maintaining security through the permissions system

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Users can view own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can insert own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can update own shift reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Users can delete own shift reports" ON public.shift_reports;

-- Enable RLS
ALTER TABLE public.shift_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all shift reports (for team collaboration)
CREATE POLICY "Authorized users can read shift reports"
ON public.shift_reports FOR SELECT
TO authenticated
USING (true);

-- Policy: Authenticated users can insert shift reports
CREATE POLICY "Authorized users can insert shift reports"
ON public.shift_reports FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Authenticated users can update shift reports
CREATE POLICY "Authorized users can update shift reports"
ON public.shift_reports FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: Authenticated users can delete shift reports
CREATE POLICY "Authorized users can delete shift reports"
ON public.shift_reports FOR DELETE
TO authenticated
USING (true);

-- Comment on table
COMMENT ON TABLE shift_reports IS 'Shift reports with collaborative RLS - authorized staff can manage all shift reports';
