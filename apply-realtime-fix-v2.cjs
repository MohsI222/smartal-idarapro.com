const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.log('Supabase service role credentials not found');
  console.log('Please set VITE_SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const client = createClient(url, serviceKey);

async function applyMigration() {
  console.log('Applying Delivery Hub Realtime fix using service role...');
  
  try {
    // Try using the SQL endpoint directly
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

-- Recreate order_messages policies
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
grant usage on schema public to anon, authenticated;
grant select on public.delivery_hub_orders to anon, authenticated;
grant select on public.delivery_hub_order_items to anon, authenticated;
grant select on public.delivery_hub_order_messages to anon, authenticated;
grant insert on public.delivery_hub_order_messages to anon, authenticated;
grant select on public.delivery_hub_products to anon, authenticated;
grant select on public.delivery_hub_stores to anon, authenticated;
    `;
    
    // Split SQL into individual statements and execute them
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length < 10) continue; // Skip empty or very short statements
      
      try {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        
        // Try using the direct SQL endpoint
        const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ sql: statement })
        });
        
        if (response.ok) {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        } else {
          const errorText = await response.text();
          console.log(`⚠️ Statement ${i + 1} failed:`, errorText);
        }
      } catch (err) {
        console.log(`❌ Statement ${i + 1} exception:`, err.message);
      }
    }
    
    console.log('\n✅ Migration process completed');
    console.log('Please check Supabase Dashboard to verify the changes');
    
  } catch (err) {
    console.log('Exception:', err.message);
  }
}

applyMigration();
