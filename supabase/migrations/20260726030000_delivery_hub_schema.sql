-- ============================================================================
-- Delivery Hub (رادار الطلبات والتوصيل) — self-healing schema
-- Stores, catalog products, orders, order items, and order chat messages
-- for the merchant delivery hub (/app/delivery-hub) and the public
-- client storefront (/m/:storeSlug, /order-status/:orderId).
--
-- تنويه مهم: الجداول هنا مُسمّاة بادئة `delivery_hub_` عمداً — قاعدة البيانات
-- عندها جداول أخرى موجودة مسبقاً بأسماء عامة (stores/products/orders/...)
-- بهياكل مختلفة تماماً وغير مرتبطة بهذا القسم إطلاقاً. لتفادي أي تصادم أو
-- مساس بها، اخترنا أسماء فريدة خاصة بقسم Delivery Hub فقط.
--
-- Design goals:
--   * No manual SQL required after this migration is applied — the app
--     self-heals by inserting a demo store/products on first dashboard load
--     (via the trusted backend, see server/deliveryHubRoutes.ts).
--   * Public (anon) clients can browse an active store, place an order and
--     track/chat about it using only the order id (no login required).
--   * Store/product/order-status ownership is managed by the app's own
--     trusted backend (server/deliveryHubRoutes.ts, bypasses RLS) via an
--     internal owner id (`delivery_hub_owners`, created in server/schema.sql)
--     — NOT via `auth.uid()` — since app accounts are authenticated through
--     a custom JWT system and don't always have a live Supabase Auth session.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- delivery_hub_stores
-- ---------------------------------------------------------------------------
create table if not exists public.delivery_hub_stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null default 'متجر التميز والسرعة',
  slug text not null unique,
  tagline text default 'أسرع توصيل بأفضل جودة 🚀',
  logo_url text,
  banner_url text,
  promo_video_url text,
  theme text not null default 'neon-modern',
  phone text,
  whatsapp text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists delivery_hub_stores_user_id_idx on public.delivery_hub_stores(user_id);
create index if not exists delivery_hub_stores_slug_idx on public.delivery_hub_stores(slug);

-- ---------------------------------------------------------------------------
-- delivery_hub_products
-- ---------------------------------------------------------------------------
create table if not exists public.delivery_hub_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.delivery_hub_stores(id) on delete cascade,
  title text not null,
  category text default 'عام',
  description text,
  price numeric(12, 2) not null default 0,
  original_price numeric(12, 2),
  image_url text,
  video_url text,
  in_stock boolean not null default true,
  sort_order int not null default 0,
  stock_quantity int not null default 0,
  low_stock_threshold int not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists delivery_hub_products_store_id_idx on public.delivery_hub_products(store_id);

-- ---------------------------------------------------------------------------
-- delivery_hub_orders
-- ---------------------------------------------------------------------------
create table if not exists public.delivery_hub_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.delivery_hub_stores(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  address text,
  notes text,
  lat double precision,
  lng double precision,
  status text not null default 'pending'
    check (status in ('pending', 'preparing', 'delivering', 'completed', 'cancelled')),
  total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists delivery_hub_orders_store_id_idx on public.delivery_hub_orders(store_id);
create index if not exists delivery_hub_orders_status_idx on public.delivery_hub_orders(status);

-- ---------------------------------------------------------------------------
-- delivery_hub_order_items
-- ---------------------------------------------------------------------------
create table if not exists public.delivery_hub_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.delivery_hub_orders(id) on delete cascade,
  product_id uuid references public.delivery_hub_products(id) on delete set null,
  title text not null,
  price numeric(12, 2) not null default 0,
  quantity int not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists delivery_hub_order_items_order_id_idx on public.delivery_hub_order_items(order_id);

-- ---------------------------------------------------------------------------
-- delivery_hub_order_messages (bidirectional chat: merchant <-> customer)
-- ---------------------------------------------------------------------------
create table if not exists public.delivery_hub_order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.delivery_hub_orders(id) on delete cascade,
  sender text not null check (sender in ('customer', 'merchant')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists delivery_hub_order_messages_order_id_idx on public.delivery_hub_order_messages(order_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.delivery_hub_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.delivery_hub_stores;
create trigger set_updated_at before update on public.delivery_hub_stores
  for each row execute function public.delivery_hub_set_updated_at();

drop trigger if exists set_updated_at on public.delivery_hub_products;
create trigger set_updated_at before update on public.delivery_hub_products
  for each row execute function public.delivery_hub_set_updated_at();

drop trigger if exists set_updated_at on public.delivery_hub_orders;
create trigger set_updated_at before update on public.delivery_hub_orders
  for each row execute function public.delivery_hub_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.delivery_hub_stores enable row level security;
alter table public.delivery_hub_products enable row level security;
alter table public.delivery_hub_orders enable row level security;
alter table public.delivery_hub_order_items enable row level security;
alter table public.delivery_hub_order_messages enable row level security;

-- stores: public can read active stores (storefront browsing). Owner
-- create/update/delete happens only via the trusted backend (bypasses RLS),
-- so no auth.uid()-based owner policies are needed here.
drop policy if exists "delivery_hub_stores_public_select_active" on public.delivery_hub_stores;
create policy "delivery_hub_stores_public_select_active" on public.delivery_hub_stores
  for select using (is_active = true);

-- products: public can read products of active stores.
drop policy if exists "delivery_hub_products_public_select" on public.delivery_hub_products;
create policy "delivery_hub_products_public_select" on public.delivery_hub_products
  for select using (
    exists (
      select 1 from public.delivery_hub_stores s
      where s.id = delivery_hub_products.store_id and s.is_active = true
    )
  );

-- Enable realtime for products (required for live updates)
alter publication supabase_realtime add table public.delivery_hub_products;

-- orders: anyone (guest checkout) can create an order for an active store;
-- reading an order only requires knowing its id (used as the private tracking
-- link). Status updates happen only via the trusted backend.
drop policy if exists "delivery_hub_orders_public_insert" on public.delivery_hub_orders;
create policy "delivery_hub_orders_public_insert" on public.delivery_hub_orders
  for insert with check (
    exists (select 1 from public.delivery_hub_stores s where s.id = delivery_hub_orders.store_id and s.is_active = true)
  );

drop policy if exists "delivery_hub_orders_public_select" on public.delivery_hub_orders;
create policy "delivery_hub_orders_public_select" on public.delivery_hub_orders
  for select using (true);

-- order_items: follows the parent order's visibility (public insert at
-- checkout time, public read for tracking).
drop policy if exists "delivery_hub_order_items_public_select" on public.delivery_hub_order_items;
create policy "delivery_hub_order_items_public_select" on public.delivery_hub_order_items
  for select using (true);

drop policy if exists "delivery_hub_order_items_public_insert" on public.delivery_hub_order_items;
create policy "delivery_hub_order_items_public_insert" on public.delivery_hub_order_items
  for insert with check (
    exists (select 1 from public.delivery_hub_orders o where o.id = delivery_hub_order_items.order_id)
  );

-- order_messages: both sides of the conversation can read/write using the
-- order id as the shared secret.
drop policy if exists "delivery_hub_order_messages_select" on public.delivery_hub_order_messages;
create policy "delivery_hub_order_messages_select" on public.delivery_hub_order_messages
  for select using (true);

drop policy if exists "delivery_hub_order_messages_insert" on public.delivery_hub_order_messages;
create policy "delivery_hub_order_messages_insert" on public.delivery_hub_order_messages
  for insert with check (
    exists (select 1 from public.delivery_hub_orders o where o.id = delivery_hub_order_messages.order_id)
  );

-- ---------------------------------------------------------------------------
-- Realtime: add tables to the realtime publication if it exists (managed
-- Supabase projects ship with `supabase_realtime` by default).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.delivery_hub_orders;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.delivery_hub_order_messages;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.delivery_hub_products;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
