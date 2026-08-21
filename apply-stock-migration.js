import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('Checking if columns exist...');
    
    // Check if columns already exist by trying to select them
    const { data, error } = await supabase
      .from('delivery_hub_products')
      .select('stock_quantity, low_stock_threshold')
      .limit(1);
    
    if (error && error.message.includes('column')) {
      console.log('❌ Columns do not exist. Please run this SQL manually in Supabase SQL Editor:');
      console.log(`
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
      `);
      process.exit(1);
    }
    
    console.log('✅ Columns already exist or migration not needed!');
  } catch (error) {
    console.error('❌ Error checking columns:', error.message);
    console.log('Please run the SQL manually in Supabase SQL Editor:');
    console.log(`
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
    `);
    process.exit(1);
  }
}

applyMigration();
