const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testFrontendAccessRestored() {
  try {
    console.log('🧪 Testing frontend access with RLS disabled...\n');
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ Missing Supabase credentials');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test 1: Access inventory products without auth
    console.log('🔍 Test 1: Access inventory products without auth...');
    const { data: invData, error: invError } = await supabase
      .from('inventory_products')
      .select('*')
      .order('name', { ascending: true })
      .limit(5);
    
    if (invError) {
      console.log(`❌ Error: ${invError.message}`);
    } else {
      console.log(`✅ Success: ${invData?.length} products`);
      if (invData && invData.length > 0) {
        invData.forEach((p, i) => {
          console.log(`   ${i + 1}. "${p.name}" (User ID: ${p.user_id})`);
        });
      }
    }
    
    // Test 2: Access shift reports without auth
    console.log('\n🔍 Test 2: Access shift reports without auth...');
    const { data: shiftData, error: shiftError } = await supabase
      .from('shift_reports')
      .select('*')
      .order('shift_date', { ascending: false })
      .limit(5);
    
    if (shiftError) {
      console.log(`❌ Error: ${shiftError.message}`);
    } else {
      console.log(`✅ Success: ${shiftData?.length} reports`);
      if (shiftData && shiftData.length > 0) {
        shiftData.forEach((r, i) => {
          console.log(`   ${i + 1}. Report ID: ${r.id}, Date: ${r.shift_date}, User: ${r.user_id}`);
        });
      }
    }
    
    // Test 3: Frontend-style query
    console.log('\n🔍 Test 3: Frontend-style query with user_id filter...');
    const primaryUserId = '0b2f773e-10f2-4d1b-8430-1751863596f3';
    const { data: queryData, error: queryError } = await supabase
      .from('inventory_products')
      .select('*')
      .order('name', { ascending: true })
      .or(`user_id.eq.${primaryUserId},user_id.is.null`);
    
    if (queryError) {
      console.log(`❌ Error: ${queryError.message}`);
    } else {
      console.log(`✅ Success: ${queryData?.length} products`);
    }
    
    console.log('\n✅ Frontend access test completed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}
testFrontendAccessRestored();
