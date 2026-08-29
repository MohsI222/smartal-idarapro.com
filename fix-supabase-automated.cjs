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
  console.log('❌ Supabase credentials not found in .env');
  process.exit(1);
}

console.log('✅ Environment loaded');
console.log(`🔗 Supabase URL: ${supabaseUrl}`);

const client = createClient(supabaseUrl, supabaseKey);

async function executeSQL(sql, description) {
  console.log(`\n📝 Executing: ${description}`);
  
  try {
    // Try using the direct SQL endpoint via POST
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ sql })
    });
    
    if (response.ok) {
      console.log(`✅ ${description} - Success`);
      return true;
    } else {
      const errorText = await response.text();
      console.log(`⚠️ ${description} - Failed: ${errorText}`);
      return false;
    }
  } catch (err) {
    console.log(`❌ ${description} - Exception: ${err.message}`);
    return false;
  }
}

async function checkTableAccess(tableName) {
  try {
    const { data, error } = await client
      .from(tableName)
      .select('count')
      .limit(1);
    
    if (error) {
      console.log(`❌ Cannot access ${tableName}: ${error.message}`);
      return false;
    } else {
      console.log(`✅ Can access ${tableName}`);
      return true;
    }
  } catch (err) {
    console.log(`❌ Exception accessing ${tableName}: ${err.message}`);
    return false;
  }
}

async function testRealtimeSubscription(tableName) {
  return new Promise((resolve) => {
    console.log(`\n🔍 Testing realtime subscription for ${tableName}...`);
    
    const channel = client.channel(`test-${tableName}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: tableName 
      }, () => {})
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Realtime working for ${tableName}`);
          client.removeChannel(channel);
          resolve(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.log(`❌ Realtime failed for ${tableName}: ${status}`);
          client.removeChannel(channel);
          resolve(false);
        }
      });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      client.removeChannel(channel);
      console.log(`⏱️ Realtime test timed out for ${tableName}`);
      resolve(false);
    }, 5000);
  });
}

async function main() {
  console.log('\n🚀 Starting automated Supabase fix...\n');
  
  // Step 1: Check current table access
  console.log('📊 Step 1: Checking current table access');
  const ordersAccess = await checkTableAccess('delivery_hub_orders');
  const messagesAccess = await checkTableAccess('delivery_hub_order_messages');
  const productsAccess = await checkTableAccess('delivery_hub_products');
  
  if (!ordersAccess || !messagesAccess || !productsAccess) {
    console.log('\n⚠️ Some tables are not accessible. Applying RLS fixes...');
  } else {
    console.log('\n✅ All tables are accessible');
  }
  
  // Step 2: Apply RLS policy fixes
  console.log('\n🔧 Step 2: Applying RLS policy fixes');
  
  const sqlStatements = [
    {
      sql: `drop policy if exists "delivery_hub_orders_public_select" on public.delivery_hub_orders;`,
      desc: 'Drop orders select policy'
    },
    {
      sql: `drop policy if exists "delivery_hub_orders_public_insert" on public.delivery_hub_orders;`,
      desc: 'Drop orders insert policy'
    },
    {
      sql: `create policy "delivery_hub_orders_public_select" on public.delivery_hub_orders for select using (true);`,
      desc: 'Create orders select policy'
    },
    {
      sql: `create policy "delivery_hub_orders_public_insert" on public.delivery_hub_orders for insert with check (exists (select 1 from public.delivery_hub_stores s where s.id = delivery_hub_orders.store_id and s.is_active = true));`,
      desc: 'Create orders insert policy'
    },
    {
      sql: `drop policy if exists "delivery_hub_order_items_public_select" on public.delivery_hub_order_items;`,
      desc: 'Drop order_items select policy'
    },
    {
      sql: `drop policy if exists "delivery_hub_order_items_public_insert" on public.delivery_hub_order_items;`,
      desc: 'Drop order_items insert policy'
    },
    {
      sql: `create policy "delivery_hub_order_items_public_select" on public.delivery_hub_order_items for select using (true);`,
      desc: 'Create order_items select policy'
    },
    {
      sql: `create policy "delivery_hub_order_items_public_insert" on public.delivery_hub_order_items for insert with check (exists (select 1 from public.delivery_hub_orders o where o.id = delivery_hub_order_items.order_id));`,
      desc: 'Create order_items insert policy'
    },
    {
      sql: `drop policy if exists "delivery_hub_order_messages_select" on public.delivery_hub_order_messages;`,
      desc: 'Drop messages select policy'
    },
    {
      sql: `drop policy if exists "delivery_hub_order_messages_insert" on public.delivery_hub_order_messages;`,
      desc: 'Drop messages insert policy'
    },
    {
      sql: `create policy "delivery_hub_order_messages_select" on public.delivery_hub_order_messages for select using (true);`,
      desc: 'Create messages select policy'
    },
    {
      sql: `create policy "delivery_hub_order_messages_insert" on public.delivery_hub_order_messages for insert with check (exists (select 1 from public.delivery_hub_orders o where o.id = delivery_hub_order_messages.order_id));`,
      desc: 'Create messages insert policy'
    }
  ];
  
  let policySuccessCount = 0;
  for (const statement of sqlStatements) {
    const success = await executeSQL(statement.sql, statement.desc);
    if (success) policySuccessCount++;
  }
  
  console.log(`\n📊 RLS Policies: ${policySuccessCount}/${sqlStatements.length} statements executed successfully`);
  
  // Step 3: Apply Realtime fixes
  console.log('\n🔧 Step 3: Applying Realtime fixes');
  
  const realtimeSQL = `
do $$
begin
  begin
    alter publication supabase_realtime drop table public.delivery_hub_orders;
  exception when undefined_object then null;
  end;
  
  begin
    alter publication supabase_realtime drop table public.delivery_hub_order_messages;
  exception when undefined_object then null;
  end;
  
  begin
    alter publication supabase_realtime drop table public.delivery_hub_products;
  exception when undefined_object then null;
  end;
  
  begin
    alter publication supabase_realtime drop table public.delivery_hub_order_items;
  exception when undefined_object then null;
  end;
  
  alter publication supabase_realtime add table public.delivery_hub_orders;
  alter publication supabase_realtime add table public.delivery_hub_order_messages;
  alter publication supabase_realtime add table public.delivery_hub_products;
  alter publication supabase_realtime add table public.delivery_hub_order_items;
end $$;
  `;
  
  const realtimeSuccess = await executeSQL(realtimeSQL, 'Enable Realtime for delivery hub tables');
  
  // Step 4: Grant permissions
  console.log('\n🔧 Step 4: Granting permissions');
  
  const permissionSQL = `
grant usage on schema public to anon, authenticated;
grant select on public.delivery_hub_orders to anon, authenticated;
grant select on public.delivery_hub_order_items to anon, authenticated;
grant select on public.delivery_hub_order_messages to anon, authenticated;
grant insert on public.delivery_hub_order_messages to anon, authenticated;
grant select on public.delivery_hub_products to anon, authenticated;
grant select on public.delivery_hub_stores to anon, authenticated;
  `;
  
  const permissionSuccess = await executeSQL(permissionSQL, 'Grant permissions to anon and authenticated');
  
  // Step 5: Verify table access again
  console.log('\n📊 Step 5: Verifying table access after fixes');
  const ordersAccessAfter = await checkTableAccess('delivery_hub_orders');
  const messagesAccessAfter = await checkTableAccess('delivery_hub_order_messages');
  const productsAccessAfter = await checkTableAccess('delivery_hub_products');
  
  // Step 6: Test Realtime subscriptions
  console.log('\n📊 Step 6: Testing Realtime subscriptions');
  const ordersRealtime = await testRealtimeSubscription('delivery_hub_orders');
  const messagesRealtime = await testRealtimeSubscription('delivery_hub_order_messages');
  const productsRealtime = await testRealtimeSubscription('delivery_hub_products');
  
  // Final summary
  console.log('\n' + '='.repeat(50));
  console.log('📋 FINAL SUMMARY');
  console.log('='.repeat(50));
  
  console.log(`\n🔐 Table Access:`);
  console.log(`  - delivery_hub_orders: ${ordersAccessAfter ? '✅' : '❌'}`);
  console.log(`  - delivery_hub_order_messages: ${messagesAccessAfter ? '✅' : '❌'}`);
  console.log(`  - delivery_hub_products: ${productsAccessAfter ? '✅' : '❌'}`);
  
  console.log(`\n⚡ Realtime Subscriptions:`);
  console.log(`  - delivery_hub_orders: ${ordersRealtime ? '✅' : '❌'}`);
  console.log(`  - delivery_hub_order_messages: ${messagesRealtime ? '✅' : '❌'}`);
  console.log(`  - delivery_hub_products: ${productsRealtime ? '✅' : '❌'}`);
  
  const allChecksPassed = 
    ordersAccessAfter && messagesAccessAfter && productsAccessAfter &&
    ordersRealtime && messagesRealtime && productsRealtime;
  
  if (allChecksPassed) {
    console.log('\n🎉 ALL CHECKS PASSED! Database is ready for real-time sync.');
    console.log('✅ No errors detected in Supabase configuration.');
    console.log('✅ Application should now work correctly with real-time updates.');
    process.exit(0);
  } else {
    console.log('\n⚠️ Some checks failed. Please review the output above.');
    console.log('❌ There may be issues with Supabase configuration.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
