-- Fix Delivery Hub RLS policies and ensure Realtime is properly enabled
-- This migration fixes permission issues and ensures realtime subscriptions work

-- Drop existing policies to recreate them properly
drop policy if exists "delivery_hub_orders_public_select" on public.delivery_hub_orders;
drop policy if exists "delivery_hub_orders_public_insert" on public.delivery_hub_orders;

drop policy if exists "delivery_hub_order_items_public_select" on public.delivery_hub_order_items;
drop policy if exists "delivery_hub_order_items_public_insert" on public.delivery_hub_order_items;

drop policy if exists "delivery_hub_order_messages_select" on public.delivery_hub_order_messages;
drop policy if exists "delivery_hub_order_messages_insert" on public.delivery_hub_order_messages;

-- Recreate orders policies with proper permissions
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

-- Ensure Realtime is enabled for all delivery hub tables
do $$
begin
  -- Remove tables first to avoid duplicate errors
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
  
  -- Add tables back to ensure they're properly enabled
  alter publication supabase_realtime add table public.delivery_hub_orders;
  alter publication supabase_realtime add table public.delivery_hub_order_messages;
  alter publication supabase_realtime add table public.delivery_hub_products;
  
  -- Also add order_items for completeness
  begin
    alter publication supabase_realtime drop table public.delivery_hub_order_items;
  exception when undefined_object then null;
  end;
  alter publication supabase_realtime add table public.delivery_hub_order_items;
  
end $$;

-- Grant necessary permissions for realtime
grant usage on schema public to anon;
grant select on public.delivery_hub_orders to anon;
grant select on public.delivery_hub_order_items to anon;
grant select on public.delivery_hub_order_messages to anon;
grant insert on public.delivery_hub_order_messages to anon;
grant select on public.delivery_hub_products to anon;
grant select on public.delivery_hub_stores to anon;
