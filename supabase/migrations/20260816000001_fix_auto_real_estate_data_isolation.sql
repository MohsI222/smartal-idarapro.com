-- Migration to fix data isolation for auto_real_estate table
-- This ensures all existing records have proper user_id assignment
-- and verifies RLS policies are working correctly

-- First, check if there are any records without user_id
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count FROM public.auto_real_estate WHERE user_id IS NULL;
    
    IF null_count > 0 THEN
        RAISE NOTICE 'Found % records without user_id. These need manual assignment.', null_count;
        -- Note: Records without user_id cannot be automatically assigned
        -- They need to be manually reviewed and assigned to appropriate users
    ELSE
        RAISE NOTICE 'All records have user_id assigned. Good!';
    END IF;
END $$;

-- Verify RLS is enabled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'auto_real_estate' 
        AND rowsecurity = true
    ) THEN
        RAISE NOTICE 'RLS is not enabled on auto_real_estate. Enabling now...';
        ALTER TABLE public.auto_real_estate ENABLE ROW LEVEL SECURITY;
    ELSE
        RAISE NOTICE 'RLS is already enabled on auto_real_estate.';
    END IF;
END $$;

-- Verify user policies exist
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'auto_real_estate'
    AND policyname LIKE 'Users can%';
    
    IF policy_count < 4 THEN
        RAISE NOTICE 'Missing user policies. Recreating...';
        
        -- Drop existing user policies if any
        DROP POLICY IF EXISTS "Users can view own auto real estate data" ON public.auto_real_estate;
        DROP POLICY IF EXISTS "Users can insert own auto real estate data" ON public.auto_real_estate;
        DROP POLICY IF EXISTS "Users can update own auto real estate data" ON public.auto_real_estate;
        DROP POLICY IF EXISTS "Users can delete own auto real estate data" ON public.auto_real_estate;
        
        -- Create user policies
        CREATE POLICY "Users can view own auto real estate data"
          ON public.auto_real_estate FOR SELECT
          USING (auth.uid() = user_id);

        CREATE POLICY "Users can insert own auto real estate data"
          ON public.auto_real_estate FOR INSERT
          WITH CHECK (auth.uid() = user_id);

        CREATE POLICY "Users can update own auto real estate data"
          ON public.auto_real_estate FOR UPDATE
          USING (auth.uid() = user_id);

        CREATE POLICY "Users can delete own auto real estate data"
          ON public.auto_real_estate FOR DELETE
          USING (auth.uid() = user_id);
    ELSE
        RAISE NOTICE 'All user policies exist.';
    END IF;
END $$;

-- Verify super admin policies exist
DO $$
DECLARE
    admin_policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_policy_count 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'auto_real_estate'
    AND policyname LIKE 'Super admin can%';
    
    IF admin_policy_count < 4 THEN
        RAISE NOTICE 'Missing super admin policies. Recreating...';
        
        -- Drop existing admin policies if any
        DROP POLICY IF EXISTS "Super admin can view all auto real estate data" ON public.auto_real_estate;
        DROP POLICY IF EXISTS "Super admin can insert all auto real estate data" ON public.auto_real_estate;
        DROP POLICY IF EXISTS "Super admin can update all auto real estate data" ON public.auto_real_estate;
        DROP POLICY IF EXISTS "Super admin can delete all auto real estate data" ON public.auto_real_estate;
        
        -- Recreate helper function
        CREATE OR REPLACE FUNCTION is_super_admin()
        RETURNS BOOLEAN AS $$
        BEGIN
          RETURN EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND email = 'lahcenm534@gmail.com'
          );
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
        
        GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;
        
        -- Create admin policies
        CREATE POLICY "Super admin can view all auto real estate data"
          ON public.auto_real_estate FOR SELECT
          USING (is_super_admin());

        CREATE POLICY "Super admin can insert all auto real estate data"
          ON public.auto_real_estate FOR INSERT
          WITH CHECK (is_super_admin());

        CREATE POLICY "Super admin can update all auto real estate data"
          ON public.auto_real_estate FOR UPDATE
          USING (is_super_admin());

        CREATE POLICY "Super admin can delete all auto real estate data"
          ON public.auto_real_estate FOR DELETE
          USING (is_super_admin());
    ELSE
        RAISE NOTICE 'All super admin policies exist.';
    END IF;
END $$;

-- Create a view to help identify data ownership issues
CREATE OR REPLACE VIEW auto_real_estate_ownership_audit AS
SELECT 
    id,
    user_id,
    type,
    brand_or_title,
    plate_or_address,
    created_at,
    CASE 
        WHEN user_id IS NULL THEN 'MISSING_USER_ID'
        ELSE 'OK'
    END as ownership_status
FROM public.auto_real_estate;

-- Add comment
COMMENT ON VIEW auto_real_estate_ownership_audit IS 'Audit view to identify records with missing user_id for data isolation';
