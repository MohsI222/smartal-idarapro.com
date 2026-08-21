/**
 * Seed Products Script - إضافة بيانات تجريبية لجدول products في Supabase
 * Run with: npx tsx seed-products.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Try to load environment variables from multiple sources
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
dotenv.config(); // Also load from default locations

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Sample products data
const sampleProducts = [
  {
    name: 'حليب كامل الدسم',
    sku: 'MILK-001',
    retail_type: 'retail',
    pieces_per_carton: 12,
    unit_price: 8.5,
    cost_price: 5.0,
    stock_pieces: 100,
    unit_kind: 'box',
    expiry_date: '2026-12-31',
    low_stock_alert: 10,
    store_id: 'default-store', // Will be replaced with actual store_id
  },
  {
    name: 'سكر أبيض',
    sku: 'SUG-002',
    retail_type: 'retail',
    pieces_per_carton: 24,
    unit_price: 3.2,
    cost_price: 2.1,
    stock_pieces: 200,
    unit_kind: 'box',
    expiry_date: '2027-06-30',
    low_stock_alert: 20,
    store_id: 'default-store',
  },
  {
    name: 'أرز بسمتي',
    sku: 'RIC-003',
    retail_type: 'retail',
    pieces_per_carton: 6,
    unit_price: 15.0,
    cost_price: 10.0,
    stock_pieces: 50,
    unit_kind: 'box',
    expiry_date: '2028-01-01',
    low_stock_alert: 5,
    store_id: 'default-store',
  },
  {
    name: 'زيت نباتي',
    sku: 'OIL-004',
    retail_type: 'retail',
    pieces_per_carton: 12,
    unit_price: 25.0,
    cost_price: 18.0,
    stock_pieces: 80,
    unit_kind: 'box',
    expiry_date: '2027-03-15',
    low_stock_alert: 8,
    store_id: 'default-store',
  },
  {
    name: 'طحين قمح',
    sku: 'FLR-005',
    retail_type: 'retail',
    pieces_per_carton: 20,
    unit_price: 12.0,
    cost_price: 8.5,
    stock_pieces: 150,
    unit_kind: 'box',
    expiry_date: '2026-11-20',
    low_stock_alert: 15,
    store_id: 'default-store',
  },
  {
    name: 'معجون طماطم',
    sku: 'TMT-006',
    retail_type: 'retail',
    pieces_per_carton: 24,
    unit_price: 4.5,
    cost_price: 3.0,
    stock_pieces: 120,
    unit_kind: 'box',
    expiry_date: '2027-02-28',
    low_stock_alert: 12,
    store_id: 'default-store',
  },
  {
    name: 'شاي أسود',
    sku: 'TEA-007',
    retail_type: 'retail',
    pieces_per_carton: 48,
    unit_price: 6.0,
    cost_price: 4.0,
    stock_pieces: 200,
    unit_kind: 'box',
    expiry_date: '2028-05-10',
    low_stock_alert: 20,
    store_id: 'default-store',
  },
  {
    name: 'قهوة فورية',
    sku: 'COF-008',
    retail_type: 'retail',
    pieces_per_carton: 12,
    unit_price: 18.0,
    cost_price: 12.0,
    stock_pieces: 60,
    unit_kind: 'box',
    expiry_date: '2027-08-15',
    low_stock_alert: 6,
    store_id: 'default-store',
  },
  {
    name: 'بسكويت سادة',
    sku: 'BIS-009',
    retail_type: 'retail',
    pieces_per_carton: 36,
    unit_price: 5.5,
    cost_price: 3.5,
    stock_pieces: 180,
    unit_kind: 'box',
    expiry_date: '2026-10-25',
    low_stock_alert: 18,
    store_id: 'default-store',
  },
  {
    name: 'عصير برتقال',
    sku: 'JUI-010',
    retail_type: 'retail',
    pieces_per_carton: 24,
    unit_price: 7.0,
    cost_price: 4.5,
    stock_pieces: 96,
    unit_kind: 'box',
    expiry_date: '2026-09-30',
    low_stock_alert: 10,
    store_id: 'default-store',
  }
];

async function addMissingColumns() {
  console.log('🔧 Adding missing columns to products table...');
  
  try {
    // Add columns using ALTER TABLE via RPC (if available) or skip
    // Since we can't execute DDL directly via client, we'll try to use a minimal insert approach
    console.log('⚠️  Note: DDL commands (ALTER TABLE) cannot be executed via Supabase client.');
    console.log('📋 Please run the SQL migration script in Supabase SQL Editor:');
    console.log('   File: migrate-products-schema.sql');
    console.log('');
    console.log('🔄 Attempting to insert with minimal fields first...');
    
    return false; // Indicate columns weren't added
  } catch (error) {
    console.error('❌ Error adding columns:', error);
    return false;
  }
}

async function seedProducts() {
  console.log('🌱 Starting to seed products...');
  console.log(`📊 Supabase URL: ${supabaseUrl}`);
  
  try {
    // First, check the actual schema of products table
    console.log('🔍 Checking products table schema...');
    const { data: schemaData, error: schemaError } = await supabase
      .from('products')
      .select('*')
      .limit(1);
    
    if (schemaError) {
      console.error('❌ Error checking schema:', schemaError);
    } else if (schemaData && schemaData.length > 0) {
      console.log('📋 Actual columns in products table:', Object.keys(schemaData[0]));
    } else {
      console.log('⚠️  No products found, table might be empty or missing columns');
    }
    
    // Try to add missing columns (will fail if not available via RPC)
    const columnsAdded = await addMissingColumns();
    
    // Get a valid store_id from the stores table
    console.log('🔍 Getting a valid store_id...');
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id')
      .limit(1);
    
    let storeId: string;
    if (storesError) {
      console.log('⚠️  Could not fetch stores, trying to create one...');
      // Try to create a default store
      const { data: newStore, error: createStoreError } = await supabase
        .from('stores')
        .insert({
          name: 'المخزن الرئيسي',
          slug: 'main-store',
        })
        .select()
        .single();
      
      if (createStoreError) {
        console.error('❌ Could not create store:', createStoreError);
        throw createStoreError;
      }
      storeId = newStore.id;
      console.log(`✅ Created new store with ID: ${storeId}`);
    } else if (stores && stores.length > 0) {
      storeId = stores[0].id;
      console.log(`✅ Using existing store_id: ${storeId}`);
    } else {
      console.log('⚠️  No stores found, creating one...');
      const { data: newStore, error: createStoreError } = await supabase
        .from('stores')
        .insert({
          name: 'المخزن الرئيسي',
          slug: 'main-store',
        })
        .select()
        .single();
      
      if (createStoreError) {
        console.error('❌ Could not create store:', createStoreError);
        throw createStoreError;
      }
      storeId = newStore.id;
      console.log(`✅ Created new store with ID: ${storeId}`);
    }
    
    // Check existing products
    const { data: existingProducts, error: fetchError } = await supabase
      .from('products')
      .select('id');
    
    if (fetchError) {
      console.error('❌ Error fetching existing products:', fetchError);
      throw fetchError;
    }
    
    console.log(`📦 Found ${existingProducts?.length || 0} existing products`);
    
    // Filter out products that already exist (by SKU if available)
    const existingSkus = new Set(existingProducts?.map((p: any) => p.sku) || []);
    const newProducts = sampleProducts.map(p => ({
      ...p,
      store_id: storeId, // Replace default store_id with actual one
    })).filter(p => !existingSkus.has(p.sku));
    
    if (newProducts.length === 0) {
      console.log('✅ All sample products already exist in the database');
      return;
    }
    
    console.log(`📝 Inserting ${newProducts.length} new products...`);
    
    // Try to insert with all fields first
    let insertedData: any[] = [];
    let insertError: any = null;
    
    try {
      const result = await supabase
        .from('products')
        .insert(newProducts)
        .select();
      
      if (result.error) throw result.error;
      insertedData = result.data || [];
    } catch (err) {
      insertError = err;
      console.log('⚠️  Full insert failed, trying minimal insert...');
      
      // Try with minimal fields (name + store_id)
      const minimalProducts = newProducts.map(p => ({
        name: p.name,
        store_id: storeId,
      }));
      
      try {
        const result = await supabase
          .from('products')
          .insert(minimalProducts)
          .select();
        
        if (result.error) throw result.error;
        insertedData = result.data || [];
        console.log('✅ Inserted with minimal fields (name only)');
      } catch (err2) {
        console.error('❌ Minimal insert also failed:', err2);
        throw err2;
      }
    }
    
    if (insertError && insertedData.length === 0) {
      console.error('❌ Error inserting products:', insertError);
      throw insertError;
    }
    
    console.log(`✅ Successfully inserted ${insertedData?.length || 0} products`);
    console.log('📋 Inserted products:');
    insertedData?.forEach((p: any) => {
      console.log(`   - ${p.name} ${p.sku ? `(${p.sku})` : ''}`);
    });
    
  } catch (error) {
    console.error('❌ Seeding失败:', error);
    process.exit(1);
  }
}

// Run the seed
seedProducts()
  .then(() => {
    console.log('✨ Seeding completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
