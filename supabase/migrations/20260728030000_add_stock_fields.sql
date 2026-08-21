-- Add stock management fields to delivery_hub_products
-- This migration adds stock_quantity and low_stock_threshold fields for inventory management

-- Add stock_quantity column (default 0)
ALTER TABLE public.delivery_hub_products 
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0;

-- Add low_stock_threshold column (default 5)
ALTER TABLE public.delivery_hub_products 
ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5;

-- Update existing products to have default values
UPDATE public.delivery_hub_products 
SET stock_quantity = 0, low_stock_threshold = 5
WHERE stock_quantity IS NULL OR low_stock_threshold IS NULL;
