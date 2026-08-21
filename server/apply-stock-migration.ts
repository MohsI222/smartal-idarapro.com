import { exec } from "./db.js";

const sql = `
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
`;

async function applyMigration() {
  try {
    console.log('Applying stock fields migration...');
    await exec(sql);
    console.log('✅ Stock fields migration applied successfully!');
  } catch (error) {
    console.error('❌ Error applying migration:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

applyMigration();
