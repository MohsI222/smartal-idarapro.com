const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testAuthenticatedSimulation() {
  try {
    console.log('🧪 Testing with simulated authenticated session...\n');
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ Missing Supabase credentials');
      return;
    }
    
    // Create client with auth session simulation
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          // Simulate authenticated request
          'Authorization': `Bearer ${supabaseKey}`,
        },
      },
    });
    
    const primaryUserId = '0b2f773e-10f2-4d1b-8430-1751863596f3';
    
    // Test inventory access with user_id filter
    console.log('🔍 Test: Inventory products with user_id filter...');
    const { data: invData, error: invError } = await supabase
      .from('inventory_products')
      .select('*')
      .eq('user_id', primaryUserId)
      .limit(5);
    
    if (invError) {
      console.log(`❌ Error: ${invError.message}`);
      console.log(`Error code: ${invError.code}`);
    } else {
      console.log(`✅ Success: ${invData?.length} products`);
      if (invData && invData.length > 0) {
        invData.forEach((p, i) => {
          console.log(`   ${i + 1}. "${p.name}"`);
        });
      }
    }
    
    // Test shift reports access with user_id filter
    console.log('\n🔍 Test: Shift reports with user_id filter...');
    const { data: shiftData, error: shiftError } = await supabase
      .from('shift_reports')
      .select('*')
      .eq('user_id', primaryUserId)
      .limit(5);
    
    if (shiftError) {
      console.log(`❌ Error: ${shiftError.message}`);
      console.log(`Error code: ${shiftError.code}`);
    } else {
      console.log(`✅ Success: ${shiftData?.length} reports`);
      if (shiftData && shiftData.length > 0) {
        shiftData.forEach((r, i) => {
          console.log(`   ${i + 1}. Report ID: ${r.id}, Date: ${r.shift_date}`);
        });
      }
    }
    
    console.log('\n✅ Authenticated simulation test completed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}
testAuthenticatedSimulation();
