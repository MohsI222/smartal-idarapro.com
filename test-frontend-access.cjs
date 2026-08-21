const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testFrontendAccess() {
  try {
    console.log('🧪 Testing frontend access to inventory_products...\n');
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ Missing Supabase credentials');
      return;
    }
    
    console.log(`📊 Supabase URL: ${supabaseUrl}`);
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test without authentication (should fail with RLS)
    console.log('\n🔍 Test 1: Access without authentication...');
    const { data: anonData, error: anonError } = await supabase
      .from('inventory_products')
      .select('*')
      .limit(5);
    
    if (anonError) {
      console.log(`❌ Expected error (RLS): ${anonError.message}`);
    } else {
      console.log(`⚠️  Unexpected success: ${anonData?.length} products`);
    }
    
    // Test with the query that frontend uses
    console.log('\n🔍 Test 2: Frontend-style query...');
    const { data: queryData, error: queryError } = await supabase
      .from('inventory_products')
      .select('*')
      .order('name', { ascending: true })
      .or('user_id.eq.0b2f773e-10f2-4d1b-8430-1751863596f3,user_id.is.null');
    
    if (queryError) {
      console.log(`❌ Query error: ${queryError.message}`);
      console.log(`Error code: ${queryError.code}`);
    } else {
      console.log(`✅ Query successful: ${queryData?.length} products`);
      if (queryData && queryData.length > 0) {
        console.log('\n📋 Sample products:');
        queryData.slice(0, 5).forEach((p, i) => {
          console.log(`${i + 1}. "${p.name}" (User ID: ${p.user_id})`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}
testFrontendAccess();
