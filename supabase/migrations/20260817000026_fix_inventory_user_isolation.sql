-- ============================================
-- Fix Inventory Products User Isolation
-- ============================================
-- This migration updates inventory_products RLS policies to ensure
-- users can only see and manage their own products while allowing
-- Super Admin full access at application level
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can delete inventory_products" ON public.inventory_products;
DROP POLICY IF EXISTS "Authenticated users can insert inventory_products" ON public.inventory_products;
DROP POLICY IF EXISTS "Authenticated users can update inventory_products" ON public.inventory_products;
DROP POLICY IF EXISTS "Authenticated users can view inventory_products" ON public.inventory_products;

-- Create user-isolated policies
CREATE POLICY "Users can view their own inventory_products"
  ON public.inventory_products FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own inventory_products"
  ON public.inventory_products FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own inventory_products"
  ON public.inventory_products FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own inventory_products"
  ON public.inventory_products FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

-- Note: Super Admin access will be handled at application level
-- by checking user email: lahcenm534@gmail.com
-- This allows Super Admin to bypass RLS for bulk import/export

-- Verify the changes
SELECT policyname, cmd, roles, qual, with_check 
FROM pg_policies 
WHERE tablename = 'inventory_products' 
AND schemaname = 'public'
ORDER BY policyname;
