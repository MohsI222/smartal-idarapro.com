const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testUserDataIsolation() {
  try {
    console.log('🧪 Testing user data isolation with RLS...\n');
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ Missing Supabase credentials');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const primaryUserId = '0b2f773e-10f2-4d1b-8430-1751863596f3'; // moutaouakullahcen@gmail.com
    
    // Test 1: Access inventory_products without auth (should fail)
    console.log('🔍 Test 1: Inventory products without auth...');
    const { data: invAnon, error: invAnonError } = await supabase
      .from('inventory_products')
      .select('*')
      .limit(5);
    
    if (invAnonError) {
      console.log(`✅ Expected error (RLS): ${invAnonError.message}`);
    } else {
      console.log(`⚠️  Unexpected success: ${invAnon?.length} products`);
    }
    
    // Test 2: Access inventory_products with specific user_id (should work)
    console.log('\n🔍 Test 2: Inventory products with user_id filter...');
    const { data: invUser, error: invUserError } = await supabase
      .from('inventory_products')
      .select('*')
      .eq('user_id', primaryUserId)
      .limit(5);
    
    if (invUserError) {
      console.log(`❌ Error: ${invUserError.message}`);
    } else {
      console.log(`✅ Success: ${invUser?.length} products for user ${primaryUserId}`);
      if (invUser && invUser.length > 0) {
        invUser.forEach((p, i) => {
          console.log(`   ${i + 1}. "${p.name}"`);
        });
      }
    }
    
    // Test 3: Access shift_reports without auth (should fail)
    console.log('\n🔍 Test 3: Shift reports without auth...');
    const { data: shiftAnon, error: shiftAnonError } = await supabase
      .from('shift_reports')
      .select('*')
      .limit(5);
    
    if (shiftAnonError) {
      console.log(`✅ Expected error (RLS): ${shiftAnonError.message}`);
    } else {
      console.log(`⚠️  Unexpected success: ${shiftAnon?.length} reports`);
    }
    
    // Test 4: Access shift_reports with specific user_id (should work)
    console.log('\n🔍 Test 4: Shift reports with user_id filter...');
    const { data: shiftUser, error: shiftUserError } = await supabase
      .from('shift_reports')
      .select('*')
      .eq('user_id', primaryUserId)
      .limit(5);
    
    if (shiftUserError) {
      console.log(`❌ Error: ${shiftUserError.message}`);
    } else {
      console.log(`✅ Success: ${shiftUser?.length} reports for user ${primaryUserId}`);
      if (shiftUser && shiftUser.length > 0) {
        shiftUser.forEach((r, i) => {
          console.log(`   ${i + 1}. Report ID: ${r.id}, Date: ${r.shift_date}`);
        });
      }
    }
    
    // Test 5: Try to access another user's data (should fail)
    console.log('\n🔍 Test 5: Access another user\'s data (should fail)...');
    const otherUserId = 'e997899b-413e-4680-b62e-77bfbfdf5ed1'; // jadnor1622@gmail.com
    const { data: otherData, error: otherError } = await supabase
      .from('shift_reports')
      .select('*')
      .eq('user_id', otherUserId)
      .limit(5);
    
    if (otherError) {
      console.log(`✅ Expected error (RLS prevents access): ${otherError.message}`);
    } else {
      console.log(`⚠️  Unexpected success: ${otherData?.length} reports (data leak!)`);
    }
    
    console.log('\n✅ Data isolation test completed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}
testUserDataIsolation();
