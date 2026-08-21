-- Migration script to fix products table schema
-- Run this in Supabase SQL Editor
-- This script will:
-- 1. Add missing columns for inventory management
-- 2. Rename 'price' to 'unit_price' if it exists
-- 3. Make store_id nullable temporarily for seeding

-- First, check current schema
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'products' 
ORDER BY ordinal_position;

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Add sku column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'sku'
    ) THEN
        ALTER TABLE products ADD COLUMN sku TEXT;
    END IF;

    -- Add retail_type column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'retail_type'
    ) THEN
        ALTER TABLE products ADD COLUMN retail_type TEXT DEFAULT 'retail';
    END IF;

    -- Add pieces_per_carton column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'pieces_per_carton'
    ) THEN
        ALTER TABLE products ADD COLUMN pieces_per_carton INTEGER DEFAULT 1;
    END IF;

    -- Add unit_price column (if price exists, we'll rename it later)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'unit_price'
    ) THEN
        ALTER TABLE products ADD COLUMN unit_price NUMERIC DEFAULT 0;
    END IF;

    -- Add stock_pieces column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'stock_pieces'
    ) THEN
        ALTER TABLE products ADD COLUMN stock_pieces INTEGER DEFAULT 0;
    END IF;

    -- Add unit_kind column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'unit_kind'
    ) THEN
        ALTER TABLE products ADD COLUMN unit_kind TEXT DEFAULT 'piece';
    END IF;

    -- Add cost_price column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'cost_price'
    ) THEN
        ALTER TABLE products ADD COLUMN cost_price NUMERIC;
    END IF;

    -- Add expiry_date column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'expiry_date'
    ) THEN
        ALTER TABLE products ADD COLUMN expiry_date TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add low_stock_alert column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'low_stock_alert'
    ) THEN
        ALTER TABLE products ADD COLUMN low_stock_alert INTEGER DEFAULT 10;
    END IF;
END $$;

-- If 'price' column exists, copy its values to 'unit_price' and drop it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'price'
    ) THEN
        -- Copy values from price to unit_price
        UPDATE products SET unit_price = price WHERE unit_price IS NULL;
        -- Drop the old price column
        ALTER TABLE products DROP COLUMN IF EXISTS price;
    END IF;
END $$;

-- Make store_id nullable temporarily for easier seeding
ALTER TABLE products ALTER COLUMN store_id DROP NOT NULL;

-- Verify the final schema
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'products' 
ORDER BY ordinal_position;
