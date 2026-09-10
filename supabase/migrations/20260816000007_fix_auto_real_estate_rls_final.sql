-- Final fix for auto_real_estate RLS to ensure product saving works
-- This ensures policies are correctly set for individual user isolation

BEGIN;

-- Step 1: Ensure RLS is enabled
ALTER TABLE IF EXISTS public.auto_real_estate ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing policies
DROP POLICY IF EXISTS "Users can view own auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Users can insert own auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Users can update own auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Users can delete own auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Super admin can view all auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Super admin can insert all auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Super admin can update all auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Super admin can delete all auto real estate data" ON public.auto_real_estate;

-- Step 3: Recreate is_super_admin function if needed
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'lahcenm534@gmail.com'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Step 4: Create user-specific policies
CREATE POLICY "Users can view own auto real estate data"
  ON public.auto_real_estate FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own auto real estate data"
  ON public.auto_real_estate FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own auto real estate data"
  ON public.auto_real_estate FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own auto real estate data"
  ON public.auto_real_estate FOR DELETE
  USING (auth.uid() = user_id);

-- Step 5: Create super admin policies
CREATE POLICY "Super admin can view all auto real estate data"
  ON public.auto_real_estate FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Super admin can insert all auto real estate data"
  ON public.auto_real_estate FOR INSERT
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin can update all auto real estate data"
  ON public.auto_real_estate FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin can delete all auto real estate data"
  ON public.auto_real_estate FOR DELETE
  USING (public.is_super_admin());

COMMIT;

-- Verification query (run separately to check)
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
-- FROM pg_policies 
-- WHERE tablename = 'auto_real_estate';
