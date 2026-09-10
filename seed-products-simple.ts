/**
 * Simple Seed Products Script - إضافة بيانات تجريبية بسيطة
 * Run with: npx tsx seed-products-simple.ts
 * This version tries to insert products with minimal fields
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Try to load environment variables from multiple sources
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
dotenv.config();

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Simple products data with minimal fields
const simpleProducts = [
  { name: 'حليب كامل الدسم', unit_price: 8.5 },
  { name: 'سكر أبيض', unit_price: 3.2 },
  { name: 'أرز بسمتي', unit_price: 15.0 },
  { name: 'زيت نباتي', unit_price: 25.0 },
  { name: 'طحين قمح', unit_price: 12.0 },
  { name: 'معجون طماطم', unit_price: 4.5 },
  { name: 'شاي أسود', unit_price: 6.0 },
  { name: 'قهوة فورية', unit_price: 18.0 },
  { name: 'بسكويت سادة', unit_price: 5.5 },
  { name: 'عصير برتقال', unit_price: 7.0 },
];

async function seedSimpleProducts() {
  console.log('🌱 Starting simple seed...');
  console.log(`📊 Supabase URL: ${supabaseUrl}`);
  
  try {
    // Check existing products
    const { data: existingProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, name');
    
    if (fetchError) {
      console.error('❌ Error fetching existing products:', fetchError);
      throw fetchError;
    }
    
    console.log(`📦 Found ${existingProducts?.length || 0} existing products`);
    
    // Filter out products that already exist (by name)
    const existingNames = new Set(existingProducts?.map((p: any) => p.name) || []);
    const newProducts = simpleProducts.filter(p => !existingNames.has(p.name));
    
    if (newProducts.length === 0) {
      console.log('✅ All sample products already exist in the database');
      return;
    }
    
    console.log(`📝 Inserting ${newProducts.length} new products with minimal fields...`);
    
    // Insert with minimal fields
    const { data: insertedData, error: insertError } = await supabase
      .from('products')
      .insert(newProducts)
      .select();
    
    if (insertError) {
      console.error('❌ Error inserting products:', insertError);
      
      // Try with UUID for store_id if it's required
      console.log('⚠️  Trying with UUID store_id...');
      const productsWithStore = newProducts.map(p => ({
        ...p,
        store_id: uuidv4(),
      }));
      
      const { data: retryData, error: retryError } = await supabase
        .from('products')
        .insert(productsWithStore)
        .select();
      
      if (retryError) {
        console.error('❌ Retry also failed:', retryError);
        console.log('');
        console.log('📋 PLEASE RUN THE SQL MIGRATION SCRIPT:');
        console.log('   File: migrate-products-schema.sql');
        console.log('   Location: Supabase Dashboard → SQL Editor');
        throw retryError;
      }
      
      console.log(`✅ Successfully inserted ${retryData?.length || 0} products with UUID store_id`);
      console.log('📋 Inserted products:');
      retryData?.forEach((p: any) => {
        console.log(`   - ${p.name}`);
      });
      return;
    }
    
    console.log(`✅ Successfully inserted ${insertedData?.length || 0} products`);
    console.log('📋 Inserted products:');
    insertedData?.forEach((p: any) => {
      console.log(`   - ${p.name}`);
    });
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run the seed
seedSimpleProducts()
  .then(() => {
    console.log('✨ Simple seeding completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
