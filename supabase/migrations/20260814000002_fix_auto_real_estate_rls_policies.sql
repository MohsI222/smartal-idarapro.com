-- Drop existing policies that reference auth.users (causing permission errors)
DROP POLICY IF EXISTS "Super admin can view all auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Super admin can insert all auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Super admin can update all auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Super admin can delete all auto real estate data" ON public.auto_real_estate;

-- Create simplified policies using a helper function
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if current user's email matches super admin email
  -- This uses the raw auth.uid() and doesn't require access to auth.users table
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'lahcenm534@gmail.com'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on the function to authenticated users
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;

-- Policy: Super admin can view all data (using function)
CREATE POLICY "Super admin can view all auto real estate data"
  ON public.auto_real_estate FOR SELECT
  USING (is_super_admin());

-- Policy: Super admin can insert all data (using function)
CREATE POLICY "Super admin can insert all auto real estate data"
  ON public.auto_real_estate FOR INSERT
  WITH CHECK (is_super_admin());

-- Policy: Super admin can update all data (using function)
CREATE POLICY "Super admin can update all auto real estate data"
  ON public.auto_real_estate FOR UPDATE
  USING (is_super_admin());

-- Policy: Super admin can delete all data (using function)
CREATE POLICY "Super admin can delete all auto real estate data"
  ON public.auto_real_estate FOR DELETE
  USING (is_super_admin());
