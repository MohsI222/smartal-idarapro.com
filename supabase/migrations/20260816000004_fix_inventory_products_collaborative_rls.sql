-- Fix RLS policies for inventory_products to enable team collaboration
-- This allows authorized managers and staff to view and manage all inventory across the company
-- while maintaining security through the permissions system

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow all operations on inventory_products" ON public.inventory_products;

-- Enable RLS
ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users with inventory permission can read all products
CREATE POLICY "Authorized users can read inventory products"
ON public.inventory_products FOR SELECT
TO authenticated
USING (
  -- User has can_access_inventory permission
  EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.user_id::text = auth.uid()::text
    AND p.can_access_inventory = true
  )
);

-- Policy: Authenticated users with inventory permission can insert products
CREATE POLICY "Authorized users can insert inventory products"
ON public.inventory_products FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.user_id::text = auth.uid()::text
    AND p.can_access_inventory = true
  )
);

-- Policy: Authenticated users with inventory permission can update products
CREATE POLICY "Authorized users can update inventory products"
ON public.inventory_products FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.user_id::text = auth.uid()::text
    AND p.can_access_inventory = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.user_id::text = auth.uid()::text
    AND p.can_access_inventory = true
  )
);

-- Policy: Authenticated users with inventory permission can delete products
CREATE POLICY "Authorized users can delete inventory products"
ON public.inventory_products FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.user_id::text = auth.uid()::text
    AND p.can_access_inventory = true
  )
);

-- Comment on table
COMMENT ON TABLE inventory_products IS 'Inventory products with collaborative RLS - authorized staff can manage all inventory';
