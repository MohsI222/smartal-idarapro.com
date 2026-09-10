-- Enable Row Level Security on auto_real_estate table
-- This migration ensures RLS is enabled and policies are properly configured

-- Enable RLS
ALTER TABLE public.auto_real_estate ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Users can insert own auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Users can update own auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Users can delete own auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Super admin can view all auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Super admin can insert all auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Super admin can update all auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Super admin can delete all auto real estate data" ON public.auto_real_estate;

-- Create user-specific policies
CREATE POLICY "Users can view own auto real estate data"
  ON public.auto_real_estate FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own auto real estate data"
  ON public.auto_real_estate FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own auto real estate data"
  ON public.auto_real_estate FOR UPDATE
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own auto real estate data"
  ON public.auto_real_estate FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- Create super admin function (if not exists)
CREATE OR REPLACE FUNCTION is_auto_real_estate_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if current user's email matches super admin email
  -- Using public.users table to avoid auth.users RLS issues
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid()::text 
    AND (email = 'lahcenm534@gmail.com' OR role = 'superadmin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on the function to authenticated users
GRANT EXECUTE ON FUNCTION is_auto_real_estate_super_admin() TO authenticated;

-- Create super admin policies
CREATE POLICY "Super admin can view all auto real estate data"
  ON public.auto_real_estate FOR SELECT
  USING (is_auto_real_estate_super_admin());

CREATE POLICY "Super admin can insert all auto real estate data"
  ON public.auto_real_estate FOR INSERT
  WITH CHECK (is_auto_real_estate_super_admin());

CREATE POLICY "Super admin can update all auto real estate data"
  ON public.auto_real_estate FOR UPDATE
  USING (is_auto_real_estate_super_admin());

CREATE POLICY "Super admin can delete all auto real estate data"
  ON public.auto_real_estate FOR DELETE
  USING (is_auto_real_estate_super_admin());

-- Verify RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'auto_real_estate';
