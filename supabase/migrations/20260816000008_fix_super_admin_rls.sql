-- Fix Super Admin RLS policies for auto_real_estate
-- This ensures the super admin (lahcenm534@gmail.com) can save products

BEGIN;

-- Step 1: Drop all existing policies
DROP POLICY IF EXISTS "Users can view own auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Users can insert own auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Users can update own auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Users can delete own auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Super admin can view all auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Super admin can insert all auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Super admin can update all auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Super admin can delete all auto real estate data" ON public.auto_real_estate;

-- Step 2: Recreate is_super_admin function with better error handling
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if current user's email matches super admin email
  -- This uses SECURITY DEFINER to bypass RLS on auth.users
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND LOWER(email) = LOWER('lahcenm534@gmail.com')
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Return false on any error to prevent blocking
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Step 3: Create user-specific policies (for regular users)
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

-- Step 4: Create super admin policies (with OR condition to allow both)
CREATE POLICY "Super admin can view all auto real estate data"
  ON public.auto_real_estate FOR SELECT
  USING (public.is_super_admin() OR auth.uid() = user_id);

CREATE POLICY "Super admin can insert all auto real estate data"
  ON public.auto_real_estate FOR INSERT
  WITH CHECK (public.is_super_admin() OR auth.uid() = user_id);

CREATE POLICY "Super admin can update all auto real estate data"
  ON public.auto_real_estate FOR UPDATE
  USING (public.is_super_admin() OR auth.uid() = user_id)
  WITH CHECK (public.is_super_admin() OR auth.uid() = user_id);

CREATE POLICY "Super admin can delete all auto real estate data"
  ON public.auto_real_estate FOR DELETE
  USING (public.is_super_admin() OR auth.uid() = user_id);

COMMIT;

-- Verification query (run separately to check)
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
-- FROM pg_policies 
-- WHERE tablename = 'auto_real_estate';
