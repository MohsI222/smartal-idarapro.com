-- Add can_access_auto_real_estate permission to permissions table
ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS can_access_auto_real_estate BOOLEAN DEFAULT false;

-- Add comment for the new column
COMMENT ON COLUMN public.permissions.can_access_auto_real_estate IS 'Permission to access Auto & Real Estate module';

-- Update wedding_invitations RLS policies to restrict to super admin only (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'wedding_invitations') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can view own wedding invitations" ON wedding_invitations;
    DROP POLICY IF EXISTS "Users can insert own wedding invitations" ON wedding_invitations;
    DROP POLICY IF EXISTS "Users can update own wedding invitations" ON wedding_invitations;
    DROP POLICY IF EXISTS "Users can delete own wedding invitations" ON wedding_invitations;

    -- Create policy to allow only super admin (lahcenm534@gmail.com) to access wedding invitations
    CREATE POLICY "Only super admin can view wedding invitations"
      ON wedding_invitations FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM auth.users
          WHERE auth.users.id = auth.uid() 
          AND auth.users.email = 'lahcenm534@gmail.com'
        )
      );

    CREATE POLICY "Only super admin can insert wedding invitations"
      ON wedding_invitations FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM auth.users
          WHERE auth.users.id = auth.uid() 
          AND auth.users.email = 'lahcenm534@gmail.com'
        )
      );

    CREATE POLICY "Only super admin can update wedding invitations"
      ON wedding_invitations FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM auth.users
          WHERE auth.users.id = auth.uid() 
          AND auth.users.email = 'lahcenm534@gmail.com'
        )
      );

    CREATE POLICY "Only super admin can delete wedding invitations"
      ON wedding_invitations FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM auth.users
          WHERE auth.users.id = auth.uid() 
          AND auth.users.email = 'lahcenm534@gmail.com'
        )
      );
  ELSE
    RAISE NOTICE 'wedding_invitations table does not exist, skipping RLS policy updates';
  END IF;
END $$;
