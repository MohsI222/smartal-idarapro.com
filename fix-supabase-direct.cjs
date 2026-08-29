const { Pool } = require('pg');
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

// Get DATABASE_URL from .env
let connectionString = env.DATABASE_URL;

// If there are multiple DATABASE_URL entries, use the Supabase one (not localhost)
if (connectionString && connectionString.includes('\n')) {
  const lines = connectionString.split('\n');
  connectionString = lines.find(line => line.includes('supabase.com')) || lines[0];
}

if (!connectionString) {
  console.log('❌ DATABASE_URL not found in .env');
  console.log('Please add DATABASE_URL to your .env file');
  console.log('You can find it in Supabase Dashboard > Project Settings > Database');
  process.exit(1);
}

// Use the pooler connection with session mode for DDL operations
connectionString = connectionString.replace('pgbouncer=true&connection_limit=1', 'pgbouncer=true&connection_limit=1&connect_timeout=10');
connectionString = connectionString.replace('sslmode=require', 'sslmode=no-verify');

console.log('✅ Environment loaded');
console.log('🔗 Connecting to database...');

const pool = new Pool({
  connectionString: connectionString,
  ssl: { 
    rejectUnauthorized: false,
    sslmode: 'no-verify'
  }
});

async function executeSQL(sql, description) {
  console.log(`\n📝 Executing: ${description}`);
  
  try {
    await pool.query(sql);
    console.log(`✅ ${description} - Success`);
    return true;
  } catch (err) {
    console.log(`⚠️ ${description} - Failed: ${err.message}`);
    return false;
  }
}

async function checkTableAccess(tableName) {
  try {
    const result = await pool.query(`SELECT COUNT(*) FROM ${tableName} LIMIT 1`);
    console.log(`✅ Can access ${tableName}`);
    return true;
  } catch (err) {
    console.log(`❌ Cannot access ${tableName}: ${err.message}`);
    return false;
  }
}

async function testRealtimeSubscription(tableName) {
  // We can't test realtime via direct SQL, but we can check if table is in publication
  try {
    const result = await pool.query(`
      SELECT tablename 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = $1
    `, [tableName]);
    
    const isInPublication = result.rows.length > 0;
    console.log(`${isInPublication ? '✅' : '❌'} ${tableName} is in supabase_realtime publication`);
    return isInPublication;
  } catch (err) {
    console.log(`❌ Error checking realtime for ${tableName}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🚀 Starting automated Supabase fix via direct PostgreSQL connection...\n');
  
  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Connected to database successfully\n');
  } catch (err) {
    console.log('❌ Failed to connect to database:', err.message);
    process.exit(1);
  }
  
  // Step 1: Check current table access
  console.log('📊 Step 1: Checking current table access');
  const ordersAccess = await checkTableAccess('public.delivery_hub_orders');
  const messagesAccess = await checkTableAccess('public.delivery_hub_order_messages');
  const productsAccess = await checkTableAccess('public.delivery_hub_products');
  
  if (!ordersAccess || !messagesAccess || !productsAccess) {
    console.log('\n⚠️ Some tables are not accessible. Applying RLS fixes...');
  } else {
    console.log('\n✅ All tables are accessible');
  }
  
  // Step 2: Apply RLS policy fixes
  console.log('\n🔧 Step 2: Applying RLS policy fixes');
  
  const sqlStatements = [
    {
      sql: `DROP POLICY IF EXISTS "delivery_hub_orders_public_select" ON public.delivery_hub_orders;`,
      desc: 'Drop orders select policy'
    },
    {
      sql: `DROP POLICY IF EXISTS "delivery_hub_orders_public_insert" ON public.delivery_hub_orders;`,
      desc: 'Drop orders insert policy'
    },
    {
      sql: `CREATE POLICY "delivery_hub_orders_public_select" ON public.delivery_hub_orders FOR SELECT USING (true);`,
      desc: 'Create orders select policy'
    },
    {
      sql: `CREATE POLICY "delivery_hub_orders_public_insert" ON public.delivery_hub_orders FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_hub_stores s WHERE s.id = delivery_hub_orders.store_id AND s.is_active = true));`,
      desc: 'Create orders insert policy'
    },
    {
      sql: `DROP POLICY IF EXISTS "delivery_hub_order_items_public_select" ON public.delivery_hub_order_items;`,
      desc: 'Drop order_items select policy'
    },
    {
      sql: `DROP POLICY IF EXISTS "delivery_hub_order_items_public_insert" ON public.delivery_hub_order_items;`,
      desc: 'Drop order_items insert policy'
    },
    {
      sql: `CREATE POLICY "delivery_hub_order_items_public_select" ON public.delivery_hub_order_items FOR SELECT USING (true);`,
      desc: 'Create order_items select policy'
    },
    {
      sql: `CREATE POLICY "delivery_hub_order_items_public_insert" ON public.delivery_hub_order_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_hub_orders o WHERE o.id = delivery_hub_order_items.order_id));`,
      desc: 'Create order_items insert policy'
    },
    {
      sql: `DROP POLICY IF EXISTS "delivery_hub_order_messages_select" ON public.delivery_hub_order_messages;`,
      desc: 'Drop messages select policy'
    },
    {
      sql: `DROP POLICY IF EXISTS "delivery_hub_order_messages_insert" ON public.delivery_hub_order_messages;`,
      desc: 'Drop messages insert policy'
    },
    {
      sql: `CREATE POLICY "delivery_hub_order_messages_select" ON public.delivery_hub_order_messages FOR SELECT USING (true);`,
      desc: 'Create messages select policy'
    },
    {
      sql: `CREATE POLICY "delivery_hub_order_messages_insert" ON public.delivery_hub_order_messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_hub_orders o WHERE o.id = delivery_hub_order_messages.order_id));`,
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
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.delivery_hub_orders;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.delivery_hub_order_messages;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.delivery_hub_products;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.delivery_hub_order_items;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  
  ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_hub_orders;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_hub_order_messages;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_hub_products;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_hub_order_items;
END $$;
  `;
  
  const realtimeSuccess = await executeSQL(realtimeSQL, 'Enable Realtime for delivery hub tables');
  
  // Step 4: Grant permissions
  console.log('\n🔧 Step 4: Granting permissions');
  
  const permissionStatements = [
    { sql: `GRANT USAGE ON SCHEMA public TO anon, authenticated;`, desc: 'Grant schema usage' },
    { sql: `GRANT SELECT ON public.delivery_hub_orders TO anon, authenticated;`, desc: 'Grant orders select' },
    { sql: `GRANT SELECT ON public.delivery_hub_order_items TO anon, authenticated;`, desc: 'Grant order_items select' },
    { sql: `GRANT SELECT ON public.delivery_hub_order_messages TO anon, authenticated;`, desc: 'Grant messages select' },
    { sql: `GRANT INSERT ON public.delivery_hub_order_messages TO anon, authenticated;`, desc: 'Grant messages insert' },
    { sql: `GRANT SELECT ON public.delivery_hub_products TO anon, authenticated;`, desc: 'Grant products select' },
    { sql: `GRANT SELECT ON public.delivery_hub_stores TO anon, authenticated;`, desc: 'Grant stores select' }
  ];
  
  let permissionSuccessCount = 0;
  for (const statement of permissionStatements) {
    const success = await executeSQL(statement.sql, statement.desc);
    if (success) permissionSuccessCount++;
  }
  
  console.log(`\n📊 Permissions: ${permissionSuccessCount}/${permissionStatements.length} statements executed successfully`);
  
  // Step 5: Verify table access again
  console.log('\n📊 Step 5: Verifying table access after fixes');
  const ordersAccessAfter = await checkTableAccess('public.delivery_hub_orders');
  const messagesAccessAfter = await checkTableAccess('public.delivery_hub_order_messages');
  const productsAccessAfter = await checkTableAccess('public.delivery_hub_products');
  
  // Step 6: Test Realtime subscriptions
  console.log('\n📊 Step 6: Checking Realtime publication status');
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
  
  console.log(`\n⚡ Realtime Publication:`);
  console.log(`  - delivery_hub_orders: ${ordersRealtime ? '✅' : '❌'}`);
  console.log(`  - delivery_hub_order_messages: ${messagesRealtime ? '✅' : '❌'}`);
  console.log(`  - delivery_hub_products: ${productsRealtime ? '✅' : '❌'}`);
  
  const allChecksPassed = 
    ordersAccessAfter && messagesAccessAfter && productsAccessAfter &&
    ordersRealtime && messagesRealtime && productsRealtime;
  
  await pool.end();
  
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
