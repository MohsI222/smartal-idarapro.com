# إصلاح مشكلة المزامنة الفورية في Delivery Hub

## المشكلة
المزامنة الفورية بين متجر الطلبات ولوحة التحكم لا تعمل بشكل صحيح، والتطبيق بطيء عند التصفح.

## الحل
يجب تشغيل SQL التالي يدوياً في Supabase Dashboard لإصلاح سياسات RLS وتفعيل Realtime بشكل صحيح.

## خطوات التطبيق

### 1. افتح Supabase Dashboard
- اذهب إلى https://supabase.com/dashboard
- اختر مشروعك

### 2. افتح SQL Editor
- من القائمة الجانبية، اختر "SQL Editor"
- انقر على "New query"

### 3. انسخ والصق SQL التالي

```sql
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
```

### 4. شغّل الاستعلام
- انقر على "Run" أو اضغط `Ctrl+Enter`
- انتظر حتى تظهر رسالة "Success"

### 5. تحقق من تفعيل Realtime
- اذهب إلى "Database" > "Replication"
- تأكد من أن الجداول التالية مفعّلة:
  - `delivery_hub_orders`
  - `delivery_hub_order_messages`
  - `delivery_hub_products`
  - `delivery_hub_order_items`

### 6. أعد تشغيل التطبيق
- أعد تحميل صفحة التطبيق
- اختبر المزامنة الفورية بين لوحة التحكم ومتجر الطلبات

## التحقق من العمل
1. افتح لوحة التحكم في نافذة متصفح
2. افتح صفحة تتبع الطلب في نافذة أخرى
3. غيّر حالة الطلب من لوحة التحكم
4. يجب أن تظهر التغييرات فوراً في صفحة التتبع بدون تحديث الصفحة
