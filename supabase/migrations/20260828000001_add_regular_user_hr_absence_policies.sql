-- Add policies for regular users to manage their own hr_absence_records
-- This allows regular users (not just super admins) to insert/view/delete their own absence records

-- Policy for regular users to view their own absence records
CREATE POLICY "Users can view own hr_absence_records"
  ON public.hr_absence_records FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

-- Policy for regular users to insert their own absence records
CREATE POLICY "Users can insert own hr_absence_records"
  ON public.hr_absence_records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

-- Policy for regular users to update their own absence records
CREATE POLICY "Users can update own hr_absence_records"
  ON public.hr_absence_records FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- Policy for regular users to delete their own absence records
CREATE POLICY "Users can delete own hr_absence_records"
  ON public.hr_absence_records FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id::text);

-- Verify the changes
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'hr_absence_records' 
AND schemaname = 'public'
ORDER BY policyname;
