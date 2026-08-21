const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testAuthenticatedAccess() {
  try {
    console.log('🧪 Testing authenticated access with RLS...\n');
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ Missing Supabase credentials');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test 1: Access without authentication (should fail)
    console.log('🔍 Test 1: Access without authentication...');
    const { data: anonData, error: anonError } = await supabase
      .from('inventory_products')
      .select('*')
      .limit(5);
    
    if (anonError) {
      console.log(`✅ Expected error (RLS): ${anonError.message}`);
    } else {
      console.log(`⚠️  Unexpected success: ${anonData?.length} products`);
    }
    
    // Test 2: Test with the valid user ID query
    console.log('\n🔍 Test 2: Query with valid user_id...');
    const validUserId = '0b2f773e-10f2-4d1b-8430-1751863596f3';
    const { data: userData, error: userError } = await supabase
      .from('inventory_products')
      .select('*')
      .eq('user_id', validUserId)
      .limit(5);
    
    if (userError) {
      console.log(`❌ Query error: ${userError.message}`);
      console.log(`Error code: ${userError.code}`);
    } else {
      console.log(`✅ Query successful: ${userData?.length} products`);
      if (userData && userData.length > 0) {
        console.log('\n📋 Sample products:');
        userData.forEach((p, i) => {
          console.log(`${i + 1}. "${p.name}" (User ID: ${p.user_id})`);
        });
      }
    }
    
    // Test 3: Test shift_reports access
    console.log('\n🔍 Test 3: Shift reports access...');
    const { data: shiftData, error: shiftError } = await supabase
      .from('shift_reports')
      .select('*')
      .eq('user_id', validUserId)
      .limit(5);
    
    if (shiftError) {
      console.log(`❌ Shift reports error: ${shiftError.message}`);
    } else {
      console.log(`✅ Shift reports successful: ${shiftData?.length} reports`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}
testAuthenticatedAccess();
