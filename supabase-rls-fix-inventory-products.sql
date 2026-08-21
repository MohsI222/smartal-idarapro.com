-- Fix RLS Policies for inventory_products table
-- Execute this in Supabase SQL Editor

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow users to read their own products" ON inventory_products;
DROP POLICY IF EXISTS "Allow users to insert their own products" ON inventory_products;
DROP POLICY IF EXISTS "Allow users to update their own products" ON inventory_products;
DROP POLICY IF EXISTS "Allow users to delete their own products" ON inventory_products;

-- Enable RLS if not already enabled
ALTER TABLE inventory_products ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT (Read)
CREATE POLICY "Allow users to read their own products"
ON inventory_products
FOR SELECT
USING (auth.uid()::text = user_id::text);

-- Policy for INSERT (Create)
CREATE POLICY "Allow users to insert their own products"
ON inventory_products
FOR INSERT
WITH CHECK (auth.uid()::text = user_id::text);

-- Policy for UPDATE (Modify)
CREATE POLICY "Allow users to update their own products"
ON inventory_products
FOR UPDATE
USING (auth.uid()::text = user_id::text)
WITH CHECK (auth.uid()::text = user_id::text);

-- Policy for DELETE (Remove)
CREATE POLICY "Allow users to delete their own products"
ON inventory_products
FOR DELETE
USING (auth.uid()::text = user_id::text);
