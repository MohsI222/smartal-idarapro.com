import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSuperAdminAccess() {
  console.log('🔍 Testing Super Admin API access...\n');

  // Test 1: Fetch HR employees via Express API (simulating Super Admin)
  console.log('📋 Test 1: Fetch HR employees via Express API');
  try {
    const response = await fetch('http://localhost:4000/api/super-admin/hr-employees', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Note: In real scenario, you'd need a valid JWT token here
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Success: Fetched ${data.length} HR employees`);
    } else {
      console.log(`❌ Failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  // Test 2: Check RLS status
  console.log('\n📋 Test 2: Check RLS status on hr_employees');
  try {
    const { data, error } = await supabase
      .from('hr_employees')
      .select('count')
      .limit(1);

    if (error) {
      console.log(`❌ RLS Error: ${error.message}`);
      console.log(`   Code: ${error.code}`);
      console.log(`   Hint: ${error.hint}`);
    } else {
      console.log(`✅ RLS is working (returned count: ${data})`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  // Test 3: Check if Super Admin function exists
  console.log('\n📋 Test 3: Check Super Admin RPC function');
  try {
    const { data, error } = await supabase.rpc('is_current_user_super_admin');

    if (error) {
      console.log(`❌ RPC Error: ${error.message}`);
    } else {
      console.log(`✅ Super Admin function exists (returns: ${data})`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log('\n🎉 Test completed');
}

testSuperAdminAccess();
