-- Create auto_real_estate table for storing cars and properties data
CREATE TABLE IF NOT EXISTS public.auto_real_estate (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('Car', 'Property', 'Land')),
  brand_or_title TEXT NOT NULL,
  plate_or_address TEXT NOT NULL,
  specs TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('Available', 'Rented', 'Sold', 'Maintenance')),
  expiry_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  image TEXT,
  
  -- Car Specs
  color TEXT,
  fuel TEXT,
  mileage TEXT,
  defects TEXT,
  rent_start TIMESTAMP WITH TIME ZONE,
  rent_end TIMESTAMP WITH TIME ZONE,

  -- Property Specs
  prop_type TEXT CHECK (prop_type IN ('Residential', 'Commercial')),
  commercial_type TEXT CHECK (commercial_type IN ('Cafe', 'Shop', 'Office')),
  floor_num INTEGER,
  total_floors INTEGER,
  rooms INTEGER,
  bathrooms INTEGER,
  amenities JSONB,

  -- Land Specs
  zoning TEXT,
  sqm NUMERIC
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_auto_real_estate_user_id ON public.auto_real_estate(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_real_estate_type ON public.auto_real_estate(type);
CREATE INDEX IF NOT EXISTS idx_auto_real_estate_status ON public.auto_real_estate(status);
CREATE INDEX IF NOT EXISTS idx_auto_real_estate_created_at ON public.auto_real_estate(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.auto_real_estate ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own data
CREATE POLICY "Users can view own auto real estate data"
  ON public.auto_real_estate FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own data
CREATE POLICY "Users can insert own auto real estate data"
  ON public.auto_real_estate FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own data
CREATE POLICY "Users can update own auto real estate data"
  ON public.auto_real_estate FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own data
CREATE POLICY "Users can delete own auto real estate data"
  ON public.auto_real_estate FOR DELETE
  USING (auth.uid() = user_id);

-- Create helper function for super admin check (avoids direct auth.users access)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if current user's email matches super admin email
  -- Uses SECURITY DEFINER to bypass RLS on auth.users
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

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_auto_real_estate_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_auto_real_estate_updated_at
  BEFORE UPDATE ON public.auto_real_estate
  FOR EACH ROW
  EXECUTE FUNCTION update_auto_real_estate_updated_at();

-- Enable Realtime for auto_real_estate table
ALTER PUBLICATION supabase_realtime ADD TABLE public.auto_real_estate;

-- Add comments
COMMENT ON TABLE public.auto_real_estate IS 'Stores cars, properties, and land inventory data with user-specific access control';
COMMENT ON COLUMN public.auto_real_estate.user_id IS 'Reference to the user in auth.users - data isolation per user';
COMMENT ON COLUMN public.auto_real_estate.type IS 'Type of asset: Car, Property, or Land';
COMMENT ON COLUMN public.auto_real_estate.brand_or_title IS 'Brand for cars or title for properties/land';
COMMENT ON COLUMN public.auto_real_estate.plate_or_address IS 'License plate for cars or address for properties/land';
COMMENT ON COLUMN public.auto_real_estate.price IS 'Price in MAD';
COMMENT ON COLUMN public.auto_real_estate.status IS 'Current status: Available, Rented, Sold, Maintenance';
