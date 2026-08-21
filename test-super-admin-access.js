import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSuperAdminAccess() {
  try {
    console.log('🔍 Testing Super Admin database-level access...\n');
    
    // Test with anon key (should still work for Super Admin via RLS policies)
    console.log('1️⃣ Testing inventory_products access:');
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('inventory_products')
      .select('*')
      .limit(1);
    
    if (inventoryError) {
      console.log(`   ❌ Error: ${inventoryError.message}`);
    } else {
      console.log(`   ✅ Access granted (${inventoryData.length} records)`);
    }
    
    console.log('\n2️⃣ Testing hr_employees access:');
    const { data: hrData, error: hrError } = await supabase
      .from('hr_employees')
      .select('*')
      .limit(1);
    
    if (hrError) {
      console.log(`   ❌ Error: ${hrError.message}`);
    } else {
      console.log(`   ✅ Access granted (${hrData.length} records)`);
    }
    
    console.log('\n3️⃣ Testing hr_absence_records access:');
    const { data: absenceData, error: absenceError } = await supabase
      .from('hr_absence_records')
      .select('*')
      .limit(1);
    
    if (absenceError) {
      console.log(`   ❌ Error: ${absenceError.message}`);
    } else {
      console.log(`   ✅ Access granted (${absenceData.length} records)`);
    }
    
    console.log('\n4️⃣ Testing shift_reports access:');
    const { data: shiftData, error: shiftError } = await supabase
      .from('shift_reports')
      .select('*')
      .limit(1);
    
    if (shiftError) {
      console.log(`   ❌ Error: ${shiftError.message}`);
    } else {
      console.log(`   ✅ Access granted (${shiftData.length} records)`);
    }
    
    console.log('\n✅ Super Admin access test completed');
    console.log('⚠️  Note: Super Admin access requires authenticated session with lahcenm534@gmail.com');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSuperAdminAccess();
