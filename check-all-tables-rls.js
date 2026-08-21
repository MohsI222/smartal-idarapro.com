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

async function checkAllTablesRLS() {
  console.log('🔍 Checking RLS status on key tables...\n');

  const tablesToCheck = [
    'hr_employees',
    'hr_absence_records',
    'inventory_products',
    'shift_reports',
    'auto_real_estate',
    'permissions',
    'invoices',
    'users'
  ];

  console.log('📋 Checking key tables for RLS:\n');

  for (const tableName of tablesToCheck) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      console.log(`📋 ${tableName}:`);
      
      if (error) {
        if (error.code === '42501') {
          console.log(`   RLS Enabled: true (permission denied)`);
          console.log(`   Status: ✅ Protected`);
        } else if (error.code === 'PGRST116') {
          console.log(`   RLS Enabled: unknown (table may not exist)`);
          console.log(`   Status: ⚠️ Table not found`);
        } else {
          console.log(`   Error: ${error.message} (${error.code})`);
        }
      } else {
        console.log(`   RLS Enabled: false (data accessible)`);
        console.log(`   Status: ❌ NOT PROTECTED`);
      }
      console.log('');
    } catch (err) {
      console.log(`❌ ${tableName}: ${err}`);
    }
  }
}

checkAllTablesRLS();
