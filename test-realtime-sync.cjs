const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#') && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });
  
  return env;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Supabase credentials not found');
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey);

console.log('🧪 Testing Real-time Sync Functionality\n');

async function testRealtimeSubscription() {
  console.log('📡 Testing real-time subscription to delivery_hub_orders...');
  
  let receivedUpdate = false;
  let testOrderId = null;
  
  // First, get an existing order to test with
  const { data: orders, error: fetchError } = await client
    .from('delivery_hub_orders')
    .select('id, status')
    .limit(1);
  
  if (fetchError) {
    console.log('❌ Error fetching orders:', fetchError.message);
    process.exit(1);
  }
  
  if (!orders || orders.length === 0) {
    console.log('⚠️ No orders found. Creating a test order...');
    
    // Get a store first
    const { data: stores, error: storeError } = await client
      .from('delivery_hub_stores')
      .select('id')
      .limit(1);
    
    if (storeError || !stores || stores.length === 0) {
      console.log('❌ No stores found. Cannot create test order.');
      process.exit(1);
    }
    
    // Create a test order
    const { data: newOrder, error: createError } = await client
      .from('delivery_hub_orders')
      .insert({
        store_id: stores[0].id,
        customer_name: 'Test Customer',
        customer_phone: '1234567890',
        status: 'pending',
        total: 100
      })
      .select()
      .single();
    
    if (createError) {
      console.log('❌ Error creating test order:', createError.message);
      process.exit(1);
    }
    
    testOrderId = newOrder.id;
    console.log(`✅ Created test order: ${testOrderId}`);
  } else {
    testOrderId = orders[0].id;
    console.log(`✅ Using existing order: ${testOrderId}`);
  }
  
  // Subscribe to real-time updates
  const channel = client.channel(`test-sync-${testOrderId}`)
    .on('postgres_changes', { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'delivery_hub_orders',
      filter: `id=eq.${testOrderId}`
    }, (payload) => {
      console.log(`📨 Real-time update received!`);
      console.log(`   Order ID: ${payload.new.id}`);
      console.log(`   Status: ${payload.new.status}`);
      console.log(`   Previous Status: ${payload.old.status}`);
      receivedUpdate = true;
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Successfully subscribed to real-time updates');
        
        // Simulate a status change after 2 seconds
        setTimeout(async () => {
          console.log('\n🔄 Simulating status change...');
          const { error: updateError } = await client
            .from('delivery_hub_orders')
            .update({ status: 'preparing' })
            .eq('id', testOrderId);
          
          if (updateError) {
            console.log('❌ Error updating order:', updateError.message);
          } else {
            console.log('✅ Order status updated in database');
          }
        }, 2000);
        
        // Wait for real-time update or timeout
        setTimeout(() => {
          client.removeChannel(channel);
          
          if (receivedUpdate) {
            console.log('\n🎉 REAL-TIME SYNC TEST PASSED!');
            console.log('✅ Updates are being received in real-time without page refresh');
            console.log('✅ No errors detected in real-time functionality');
            process.exit(0);
          } else {
            console.log('\n⚠️ REAL-TIME SYNC TEST FAILED');
            console.log('❌ No real-time update received within timeout');
            console.log('❌ There may be an issue with real-time subscriptions');
            process.exit(1);
          }
        }, 8000);
      } else if (status === 'CHANNEL_ERROR') {
        console.log('❌ Failed to subscribe to real-time updates');
        process.exit(1);
      }
    });
}

testRealtimeSubscription().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
