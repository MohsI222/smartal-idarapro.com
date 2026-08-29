const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log('Supabase credentials not found');
  process.exit(1);
}

const client = createClient(url, key);

async function applyMigration() {
  console.log('Applying Delivery Hub Realtime fix...');
  
  try {
    // Execute SQL to fix RLS policies and enable Realtime
    const sql = `
-- Drop existing policies
drop policy if exists "delivery_hub_orders_public_select" on public.delivery_hub_orders;
drop policy if exists "delivery_hub_orders_public_insert" on public.delivery_hub_orders;

drop policy if exists "delivery_hub_order_items_public_select" on public.delivery_hub_order_items;
drop policy if exists "delivery_hub_order_items_public_insert" on public.delivery_hub_order_items;

drop policy if exists "delivery_hub_order_messages_select" on public.delivery_hub_order_messages;
drop policy if exists "delivery_hub_order_messages_insert" on public.delivery_hub_order_messages;

-- Recreate orders policies
create policy "delivery_hub_orders_public_select" on public.delivery_hub_orders
  for select using (true);

create policy "delivery_hub_orders_public_insert" on public.delivery_hub_orders
  for insert with check (
    exists (select 1 from public.delivery_hub_stores s where s.id = delivery_hub_orders.store_id and s.is_active = true)
  );

-- Recreate order_items policies
create policy "delivery_hub_order_items_public_select" on public.delivery_hub_order_items
  for select using (true);

create policy "delivery_hub_order_items_public_insert" on public.delivery_hub_order_items
  for insert with check (
    exists (select 1 from public.delivery_hub_orders o where o.id = delivery_hub_order_items.order_id)
  );

-- Recreate order_messages policies without sender restriction
create policy "delivery_hub_order_messages_select" on public.delivery_hub_order_messages
  for select using (true);

create policy "delivery_hub_order_messages_insert" on public.delivery_hub_order_messages
  for insert with check (
    exists (select 1 from public.delivery_hub_orders o where o.id = delivery_hub_order_messages.order_id)
  );

-- Ensure Realtime is enabled
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

-- Grant permissions
grant usage on schema public to anon;
grant select on public.delivery_hub_orders to anon;
grant select on public.delivery_hub_order_items to anon;
grant select on public.delivery_hub_order_messages to anon;
grant insert on public.delivery_hub_order_messages to anon;
grant select on public.delivery_hub_products to anon;
grant select on public.delivery_hub_stores to anon;
    `;
    
    // Execute the SQL using rpc
    const { data, error } = await client.rpc('exec_sql', { sql });
    
    if (error) {
      console.log('Error executing SQL via RPC:', error.message);
      console.log('Trying direct SQL execution...');
      
      // Try using the SQL editor endpoint
      const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({ sql })
      });
      
      if (!response.ok) {
        console.log('Direct SQL execution also failed');
        console.log('Please manually run the SQL in Supabase SQL Editor');
        console.log('\nSQL to run:');
        console.log(sql);
      } else {
        console.log('✅ Migration applied successfully');
      }
    } else {
      console.log('✅ Migration applied successfully');
    }
    
  } catch (err) {
    console.log('Exception:', err.message);
    console.log('Please manually run the SQL in Supabase SQL Editor');
  }
}

applyMigration();
