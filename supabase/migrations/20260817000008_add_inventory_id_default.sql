-- ============================================
-- Add UUID Default for inventory_products id
-- ============================================
-- This migration adds a UUID default value for the id column
-- to fix the "null value in column id" error
-- ============================================

-- Add UUID default to id column
ALTER TABLE public.inventory_products 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Verify the change
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_name = 'inventory_products' AND column_name = 'id';
