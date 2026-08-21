-- Inventory Products Table
-- This table stores inventory products for the inventory management system

CREATE TABLE IF NOT EXISTS public.inventory_products (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  retail_type TEXT NOT NULL DEFAULT 'retail',
  pieces_per_carton INTEGER NOT NULL DEFAULT 1,
  unit_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  stock_pieces INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unit_kind TEXT NOT NULL DEFAULT 'piece',
  cost_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  expiry_date TEXT,
  low_stock_alert INTEGER NOT NULL DEFAULT 10,
  video_url TEXT,
  video_file_path TEXT,
  video_file_name TEXT,
  video_mime TEXT
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_inventory_products_user_id ON public.inventory_products(user_id);

-- Create index on name for search
CREATE INDEX IF NOT EXISTS idx_inventory_products_name ON public.inventory_products(name);

-- Enable Row Level Security
ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see their own products
CREATE POLICY "Users can view own inventory products"
  ON public.inventory_products FOR SELECT
  USING (auth.uid()::text = user_id);

-- Create policy to allow users to insert their own products
CREATE POLICY "Users can insert own inventory products"
  ON public.inventory_products FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Create policy to allow users to update their own products
CREATE POLICY "Users can update own inventory products"
  ON public.inventory_products FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Create policy to allow users to delete their own products
CREATE POLICY "Users can delete own inventory products"
  ON public.inventory_products FOR DELETE
  USING (auth.uid()::text = user_id);
