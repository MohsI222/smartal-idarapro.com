-- Create permissions table for managing user access to different sections
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_access_inventory BOOLEAN DEFAULT false,
  can_access_hr BOOLEAN DEFAULT false,
  can_access_delivery BOOLEAN DEFAULT false,
  can_access_transport_logistics BOOLEAN DEFAULT false,
  can_access_wedding_invitations BOOLEAN DEFAULT false,
  can_access_legal BOOLEAN DEFAULT false,
  can_access_ai BOOLEAN DEFAULT false,
  can_access_settings BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can read their own permissions
CREATE POLICY "Users can read own permissions"
  ON public.permissions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Users can update their own permissions (if allowed)
CREATE POLICY "Users can update own permissions"
  ON public.permissions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policy: Admins can read all permissions
CREATE POLICY "Admins can read all permissions"
  ON public.permissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.permissions
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Create policy: Admins can update all permissions
CREATE POLICY "Admins can update all permissions"
  ON public.permissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.permissions
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Create policy: Admins can insert permissions
CREATE POLICY "Admins can insert permissions"
  ON public.permissions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.permissions
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Create policy: Admins can delete permissions
CREATE POLICY "Admins can delete permissions"
  ON public.permissions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.permissions
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at
CREATE TRIGGER update_permissions_updated_at
  BEFORE UPDATE ON public.permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Realtime for permissions table
ALTER PUBLICATION supabase_realtime ADD TABLE public.permissions;

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_permissions_user_id ON public.permissions(user_id);

-- Create index on is_admin for faster admin lookups
CREATE INDEX IF NOT EXISTS idx_permissions_is_admin ON public.permissions(is_admin);

-- Comment on table
COMMENT ON TABLE public.permissions IS 'Stores user permissions for accessing different sections of the application';

-- Comment on columns
COMMENT ON COLUMN public.permissions.user_id IS 'Reference to the user in auth.users';
COMMENT ON COLUMN public.permissions.can_access_inventory IS 'Permission to access inventory/POS module';
COMMENT ON COLUMN public.permissions.can_access_hr IS 'Permission to access HR module';
COMMENT ON COLUMN public.permissions.can_access_delivery IS 'Permission to access delivery hub module';
COMMENT ON COLUMN public.permissions.can_access_transport_logistics IS 'Permission to access transport logistics module';
COMMENT ON COLUMN public.permissions.can_access_wedding_invitations IS 'Permission to access wedding invitations module';
COMMENT ON COLUMN public.permissions.can_access_legal IS 'Permission to access legal module';
COMMENT ON COLUMN public.permissions.can_access_ai IS 'Permission to access AI features';
COMMENT ON COLUMN public.permissions.can_access_settings IS 'Permission to access settings';
COMMENT ON COLUMN public.permissions.is_admin IS 'Admin flag - admins can manage other users permissions';
