-- Fix RLS policies to allow deletion and updates
-- Run this in Supabase SQL Editor

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view production_requests" ON production_requests;
DROP POLICY IF EXISTS "Users can insert production_requests" ON production_requests;
DROP POLICY IF EXISTS "Users can update production_requests" ON production_requests;
DROP POLICY IF EXISTS "Users can delete production_requests" ON production_requests;

DROP POLICY IF EXISTS "Users can view logistics_queue" ON logistics_queue;
DROP POLICY IF EXISTS "Users can insert logistics_queue" ON logistics_queue;
DROP POLICY IF EXISTS "Users can update logistics_queue" ON logistics_queue;
DROP POLICY IF EXISTS "Users can delete logistics_queue" ON logistics_queue;

-- Create more permissive policies for production_requests
-- Allow authenticated users to view all production_requests
CREATE POLICY "Authenticated users can view production_requests" ON production_requests
    FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert production_requests
CREATE POLICY "Authenticated users can insert production_requests" ON production_requests
    FOR INSERT TO authenticated WITH CHECK (true);

-- Allow authenticated users to update production_requests
CREATE POLICY "Authenticated users can update production_requests" ON production_requests
    FOR UPDATE TO authenticated USING (true);

-- Allow authenticated users to delete production_requests
CREATE POLICY "Authenticated users can delete production_requests" ON production_requests
    FOR DELETE TO authenticated USING (true);

-- Create more permissive policies for logistics_queue
-- Allow authenticated users to view all logistics_queue
CREATE POLICY "Authenticated users can view logistics_queue" ON logistics_queue
    FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert logistics_queue
CREATE POLICY "Authenticated users can insert logistics_queue" ON logistics_queue
    FOR INSERT TO authenticated WITH CHECK (true);

-- Allow authenticated users to update logistics_queue
CREATE POLICY "Authenticated users can update logistics_queue" ON logistics_queue
    FOR UPDATE TO authenticated USING (true);

-- Allow authenticated users to delete logistics_queue
CREATE POLICY "Authenticated users can delete logistics_queue" ON logistics_queue
    FOR DELETE TO authenticated USING (true);

-- Also fix products table policies to allow updates
DROP POLICY IF EXISTS "Users can view products" ON products;
DROP POLICY IF EXISTS "Users can insert products" ON products;
DROP POLICY IF EXISTS "Users can update products" ON products;
DROP POLICY IF EXISTS "Users can delete products" ON products;

-- Allow authenticated users to view all products
CREATE POLICY "Authenticated users can view products" ON products
    FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert products
CREATE POLICY "Authenticated users can insert products" ON products
    FOR INSERT TO authenticated WITH CHECK (true);

-- Allow authenticated users to update products
CREATE POLICY "Authenticated users can update products" ON products
    FOR UPDATE TO authenticated USING (true);

-- Allow authenticated users to delete products
CREATE POLICY "Authenticated users can delete products" ON products
    FOR DELETE TO authenticated USING (true);
