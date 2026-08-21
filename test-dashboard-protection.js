import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Create Supabase client with anon key
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDashboardProtection() {
  try {
    console.log('🔍 Testing dashboard protection with anon access...\n');
    
    // Test 1: Try to access inventory_products (should fail or be empty)
    console.log('1️⃣ Testing inventory_products access:');
    const { data: products, error: productsError } = await supabase
      .from('inventory_products')
      .select('*')
      .limit(5);
    
    if (productsError) {
      console.log(`   ❌ Error: ${productsError.message}`);
    } else {
      console.log(`   ⚠️  Access granted: ${products.length} records (should be 0 for anon)`);
    }
    
    // Test 2: Try to access shift_reports (should fail or be empty)
    console.log('\n2️⃣ Testing shift_reports access:');
    const { data: shifts, error: shiftsError } = await supabase
      .from('shift_reports')
      .select('*')
      .limit(5);
    
    if (shiftsError) {
      console.log(`   ❌ Error: ${shiftsError.message}`);
    } else {
      console.log(`   ⚠️  Access granted: ${shifts.length} records (should be 0 for anon)`);
    }
    
    // Test 3: Try to access hr_employees (should fail or be empty)
    console.log('\n3️⃣ Testing hr_employees access:');
    const { data: employees, error: employeesError } = await supabase
      .from('hr_employees')
      .select('*')
      .limit(5);
    
    if (employeesError) {
      console.log(`   ❌ Error: ${employeesError.message}`);
    } else {
      console.log(`   ⚠️  Access granted: ${employees.length} records (should be 0 for anon)`);
    }
    
    // Test 4: Try to access hr_absence_records (should fail or be empty)
    console.log('\n4️⃣ Testing hr_absence_records access:');
    const { data: absence, error: absenceError } = await supabase
      .from('hr_absence_records')
      .select('*')
      .limit(5);
    
    if (absenceError) {
      console.log(`   ❌ Error: ${absenceError.message}`);
    } else {
      console.log(`   ⚠️  Access granted: ${absence.length} records (should be 0 for anon)`);
    }
    
    console.log('\n✅ Dashboard protection test completed');
    console.log('⚠️  Note: Anon access should be blocked for dashboard data');
    console.log('   Authenticated users can only see their own data');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDashboardProtection();
