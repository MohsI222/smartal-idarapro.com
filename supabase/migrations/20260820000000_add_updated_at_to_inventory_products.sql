-- Add updated_at column to inventory_products table
-- This migration adds the missing updated_at timestamp column

ALTER TABLE public.inventory_products 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inventory_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on row update
DROP TRIGGER IF EXISTS trigger_update_inventory_products_updated_at ON public.inventory_products;
CREATE TRIGGER trigger_update_inventory_products_updated_at
  BEFORE UPDATE ON public.inventory_products
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_products_updated_at();
