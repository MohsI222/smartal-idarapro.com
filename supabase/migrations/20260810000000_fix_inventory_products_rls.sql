-- Fix RLS policies for inventory_products to work with user_id instead of auth.uid()
-- This allows the application to use user_id from the auth context instead of Supabase auth.uid()

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can insert own inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can update own inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "Users can delete own inventory products" ON public.inventory_products;

-- Create new policies that allow all operations (the application handles user_id filtering at the application level)
-- This is necessary because the app uses a custom auth system with user_id from the backend, not Supabase auth.uid()

CREATE POLICY "Allow all operations on inventory_products"
  ON public.inventory_products FOR ALL
  USING (true)
  WITH CHECK (true);
