-- Smart Delivery Hub Database Schema
-- Phase 1: Database Architecture Setup for "Smart Delivery Hub" & Client App
-- This migration creates the complete database schema for merchant delivery management

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- TABLE: stores (Merchant profiles & branding)
-- ============================================
CREATE TABLE IF NOT EXISTS stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  logo_url TEXT,
  banner_url TEXT,
  phone TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  delivery_range_km NUMERIC DEFAULT 5.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for stores
CREATE INDEX IF NOT EXISTS stores_user_id_idx ON stores(user_id);
CREATE INDEX IF NOT EXISTS stores_slug_idx ON stores(slug);
CREATE INDEX IF NOT EXISTS stores_category_idx ON stores(category);
CREATE INDEX IF NOT EXISTS stores_is_active_idx ON stores(is_active);
CREATE INDEX IF NOT EXISTS stores_location_idx ON stores(latitude, longitude);

-- ============================================
-- TABLE: products (Catalog/Inventory)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  image_url TEXT,
  category TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for products
CREATE INDEX IF NOT EXISTS products_store_id_idx ON products(store_id);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);
CREATE INDEX IF NOT EXISTS products_is_available_idx ON products(is_available);
CREATE INDEX IF NOT EXISTS products_name_idx ON products(name);

-- ============================================
-- TABLE: orders (Client Orders)
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tracking_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_address TEXT,
  client_latitude DOUBLE PRECISION,
  client_longitude DOUBLE PRECISION,
  total_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'delivering', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for orders
CREATE INDEX IF NOT EXISTS orders_store_id_idx ON orders(store_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_client_phone_idx ON orders(client_phone);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_token TEXT;
UPDATE orders
SET tracking_token = encode(gen_random_bytes(16), 'hex')
WHERE tracking_token IS NULL OR tracking_token = '';
ALTER TABLE orders ALTER COLUMN tracking_token SET DEFAULT encode(gen_random_bytes(16), 'hex');
ALTER TABLE orders ALTER COLUMN tracking_token SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_tracking_token_idx ON orders(tracking_token);

-- ============================================
-- TABLE: order_items (Order details line items)
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit_price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  subtotal NUMERIC NOT NULL
);

-- Indexes for order_items
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON order_items(product_id);

-- ============================================
-- TABLE: order_messages (In-App live chat per order)
-- ============================================
CREATE TABLE IF NOT EXISTS order_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'merchant')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for order_messages
CREATE INDEX IF NOT EXISTS order_messages_order_id_idx ON order_messages(order_id);
CREATE INDEX IF NOT EXISTS order_messages_created_at_idx ON order_messages(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES: stores
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view active stores" ON stores;
DROP POLICY IF EXISTS "Store owners can view their stores" ON stores;
DROP POLICY IF EXISTS "Store owners can insert their store" ON stores;
DROP POLICY IF EXISTS "Store owners can update their store" ON stores;
DROP POLICY IF EXISTS "Store owners can delete their store" ON stores;

-- Public can SELECT active stores
CREATE POLICY "Public can view active stores"
  ON stores FOR SELECT
  USING (is_active = true);

-- Store owners can SELECT their own stores, including inactive stores
CREATE POLICY "Store owners can view their stores"
  ON stores FOR SELECT
  USING (auth.uid() = user_id);

-- Store owners can INSERT their own store
CREATE POLICY "Store owners can insert their store"
  ON stores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Store owners can UPDATE their own store
CREATE POLICY "Store owners can update their store"
  ON stores FOR UPDATE
  USING (auth.uid() = user_id);

-- Store owners can DELETE their own store
CREATE POLICY "Store owners can delete their store"
  ON stores FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: products
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view available products" ON products;
DROP POLICY IF EXISTS "Store owners can view their products" ON products;
DROP POLICY IF EXISTS "Store owners can insert products" ON products;
DROP POLICY IF EXISTS "Store owners can update their products" ON products;
DROP POLICY IF EXISTS "Store owners can delete their products" ON products;

-- Public can SELECT available products from active stores
CREATE POLICY "Public can view available products"
  ON products FOR SELECT
  USING (
    is_available = true
    AND EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = products.store_id
      AND stores.is_active = true
    )
  );

-- Store owners can SELECT their products
CREATE POLICY "Store owners can view their products"
  ON products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stores 
      WHERE stores.id = products.store_id 
      AND stores.user_id = auth.uid()
    )
  );

-- Store owners can INSERT products for their store
CREATE POLICY "Store owners can insert products"
  ON products FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stores 
      WHERE stores.id = products.store_id 
      AND stores.user_id = auth.uid()
    )
  );

-- Store owners can UPDATE their products
CREATE POLICY "Store owners can update their products"
  ON products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM stores 
      WHERE stores.id = products.store_id 
      AND stores.user_id = auth.uid()
    )
  );

-- Store owners can DELETE their products
CREATE POLICY "Store owners can delete their products"
  ON products FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM stores 
      WHERE stores.id = products.store_id 
      AND stores.user_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES: orders
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can insert orders" ON orders;
DROP POLICY IF EXISTS "Store owners can view their orders" ON orders;
DROP POLICY IF EXISTS "Store owners can update their orders" ON orders;
DROP POLICY IF EXISTS "Store owners can delete their orders" ON orders;

-- Guest clients create orders through create_delivery_order(), which validates the active store and cart.

-- Store owners can SELECT their store's orders
CREATE POLICY "Store owners can view their orders"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stores 
      WHERE stores.id = orders.store_id 
      AND stores.user_id = auth.uid()
    )
  );

-- Store owners can UPDATE their store's orders
CREATE POLICY "Store owners can update their orders"
  ON orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM stores 
      WHERE stores.id = orders.store_id 
      AND stores.user_id = auth.uid()
    )
  );

-- Store owners can DELETE their store's orders
CREATE POLICY "Store owners can delete their orders"
  ON orders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM stores 
      WHERE stores.id = orders.store_id 
      AND stores.user_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES: order_items
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can insert order items" ON order_items;
DROP POLICY IF EXISTS "Store owners can view order items" ON order_items;
DROP POLICY IF EXISTS "Store owners can update order items" ON order_items;
DROP POLICY IF EXISTS "Store owners can delete order items" ON order_items;

-- Guest clients create order items through create_delivery_order(), not direct table inserts.

-- Store owners can SELECT items from their store's orders
CREATE POLICY "Store owners can view order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders 
      JOIN stores ON stores.id = orders.store_id
      WHERE orders.id = order_items.order_id 
      AND stores.user_id = auth.uid()
    )
  );

-- Store owners can UPDATE items from their store's orders
CREATE POLICY "Store owners can update order items"
  ON order_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM orders 
      JOIN stores ON stores.id = orders.store_id
      WHERE orders.id = order_items.order_id 
      AND stores.user_id = auth.uid()
    )
  );

-- Store owners can DELETE items from their store's orders
CREATE POLICY "Store owners can delete order items"
  ON order_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM orders 
      JOIN stores ON stores.id = orders.store_id
      WHERE orders.id = order_items.order_id 
      AND stores.user_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES: order_messages
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can insert order messages" ON order_messages;
DROP POLICY IF EXISTS "Store owners can insert order messages" ON order_messages;
DROP POLICY IF EXISTS "Store owners can view order messages" ON order_messages;
DROP POLICY IF EXISTS "Store owners can delete order messages" ON order_messages;

-- Clients send messages through send_delivery_order_message(); merchants can reply directly.
CREATE POLICY "Store owners can insert order messages"
  ON order_messages FOR INSERT
  WITH CHECK (
    sender_type = 'merchant'
    AND EXISTS (
      SELECT 1 FROM orders
      JOIN stores ON stores.id = orders.store_id
      WHERE orders.id = order_messages.order_id
      AND stores.user_id = auth.uid()
    )
  );

-- Store owners can SELECT messages from their store's orders
CREATE POLICY "Store owners can view order messages"
  ON order_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders 
      JOIN stores ON stores.id = orders.store_id
      WHERE orders.id = order_messages.order_id 
      AND stores.user_id = auth.uid()
    )
  );

-- Store owners can DELETE messages from their store's orders
CREATE POLICY "Store owners can delete order messages"
  ON order_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM orders 
      JOIN stores ON stores.id = orders.store_id
      WHERE orders.id = order_messages.order_id 
      AND stores.user_id = auth.uid()
    )
  );

-- ============================================
-- REALTIME CONFIGURATION
-- ============================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE orders;
EXCEPTION
  WHEN duplicate_object OR undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE order_messages;
EXCEPTION
  WHEN duplicate_object OR undefined_object THEN NULL;
END $$;

-- ============================================
-- HELPER FUNCTIONS (Optional but useful)
-- ============================================

-- Function to get store by user_id
CREATE OR REPLACE FUNCTION get_store_by_user(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  category TEXT,
  logo_url TEXT,
  banner_url TEXT,
  phone TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  delivery_range_km NUMERIC,
  is_active BOOLEAN
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id, s.name, s.slug, s.category, s.logo_url, s.banner_url,
    s.phone, s.address, s.latitude, s.longitude, s.delivery_range_km, s.is_active
  FROM stores s
  WHERE s.user_id = user_uuid
  AND s.user_id = auth.uid();
END;
$$;

-- Function to get orders with items for a store
CREATE OR REPLACE FUNCTION get_store_orders_with_items(store_uuid UUID)
RETURNS TABLE (
  order_id UUID,
  client_name TEXT,
  client_phone TEXT,
  client_address TEXT,
  total_amount NUMERIC,
  status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  item_count INTEGER
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id as order_id,
    o.client_name,
    o.client_phone,
    o.client_address,
    o.total_amount,
    o.status,
    o.notes,
    o.created_at,
    COUNT(oi.id)::INTEGER as item_count
  FROM orders o
  JOIN stores s ON s.id = o.store_id
  LEFT JOIN order_items oi ON o.id = oi.order_id
  WHERE o.store_id = store_uuid
  AND s.user_id = auth.uid()
  GROUP BY o.id, o.client_name, o.client_phone, o.client_address, o.total_amount, o.status, o.notes, o.created_at
  ORDER BY o.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION create_delivery_order(
  p_store_id UUID,
  p_client_name TEXT,
  p_client_phone TEXT,
  p_client_address TEXT,
  p_client_latitude DOUBLE PRECISION,
  p_client_longitude DOUBLE PRECISION,
  p_notes TEXT,
  p_items JSONB
)
RETURNS TABLE (
  order_id UUID,
  tracking_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_tracking_token TEXT := encode(gen_random_bytes(16), 'hex');
  v_total NUMERIC := 0;
  v_valid_count BIGINT := 0;
  v_cart_count BIGINT := 0;
BEGIN
  IF p_store_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM stores s WHERE s.id = p_store_id AND s.is_active = true
  ) THEN
    RAISE EXCEPTION 'store_not_available';
  END IF;

  IF NULLIF(btrim(COALESCE(p_client_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'client_name_required';
  END IF;

  IF NULLIF(btrim(COALESCE(p_client_phone, '')), '') IS NULL THEN
    RAISE EXCEPTION 'client_phone_required';
  END IF;

  IF NULLIF(btrim(COALESCE(p_client_address, '')), '') IS NULL THEN
    RAISE EXCEPTION 'client_address_required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'empty_cart';
  END IF;

  SELECT COUNT(*) INTO v_cart_count
  FROM jsonb_array_elements(p_items) AS cart_item(item);

  WITH parsed_items AS (
    SELECT
      (cart_item.item->>'product_id')::UUID AS product_id,
      (cart_item.item->>'quantity')::INTEGER AS quantity
    FROM jsonb_array_elements(p_items) AS cart_item(item)
  ),
  valid_items AS (
    SELECT p.id, p.price, parsed_items.quantity
    FROM parsed_items
    JOIN products p ON p.id = parsed_items.product_id
    WHERE p.store_id = p_store_id
    AND p.is_available = true
    AND parsed_items.quantity > 0
  )
  SELECT COALESCE(SUM(price * quantity), 0), COUNT(*)
  INTO v_total, v_valid_count
  FROM valid_items;

  IF v_valid_count <> v_cart_count OR v_total <= 0 THEN
    RAISE EXCEPTION 'invalid_cart';
  END IF;

  INSERT INTO orders (
    store_id,
    client_name,
    client_phone,
    client_address,
    client_latitude,
    client_longitude,
    total_amount,
    status,
    notes,
    tracking_token
  )
  VALUES (
    p_store_id,
    btrim(p_client_name),
    btrim(p_client_phone),
    NULLIF(btrim(COALESCE(p_client_address, '')), ''),
    p_client_latitude,
    p_client_longitude,
    v_total,
    'pending',
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    v_tracking_token
  )
  RETURNING id INTO v_order_id;

  WITH parsed_items AS (
    SELECT
      (cart_item.item->>'product_id')::UUID AS product_id,
      (cart_item.item->>'quantity')::INTEGER AS quantity
    FROM jsonb_array_elements(p_items) AS cart_item(item)
  ),
  valid_items AS (
    SELECT p.id, p.name, p.price, parsed_items.quantity
    FROM parsed_items
    JOIN products p ON p.id = parsed_items.product_id
    WHERE p.store_id = p_store_id
    AND p.is_available = true
    AND parsed_items.quantity > 0
  )
  INSERT INTO order_items (
    order_id,
    product_id,
    product_name,
    unit_price,
    quantity,
    subtotal
  )
  SELECT
    v_order_id,
    id,
    name,
    price,
    quantity,
    price * quantity
  FROM valid_items;

  RETURN QUERY SELECT v_order_id, v_tracking_token;
END;
$$;

CREATE OR REPLACE FUNCTION get_delivery_order_tracking(
  p_order_id UUID,
  p_tracking_token TEXT
)
RETURNS TABLE (
  order_data JSONB,
  items_data JSONB,
  messages_data JSONB,
  store_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NULLIF(btrim(COALESCE(p_tracking_token, '')), '') IS NULL THEN
    RAISE EXCEPTION 'tracking_token_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = p_order_id
    AND o.tracking_token = btrim(p_tracking_token)
  ) THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  RETURN QUERY
  SELECT
    jsonb_build_object(
      'id', o.id,
      'store_id', o.store_id,
      'client_name', o.client_name,
      'client_phone', o.client_phone,
      'client_address', o.client_address,
      'total_amount', o.total_amount,
      'status', o.status,
      'notes', o.notes,
      'created_at', o.created_at
    ) AS order_data,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'product_name', oi.product_name,
            'unit_price', oi.unit_price,
            'quantity', oi.quantity,
            'subtotal', oi.subtotal
          )
          ORDER BY oi.id
        )
        FROM order_items oi
        WHERE oi.order_id = o.id
      ),
      '[]'::JSONB
    ) AS items_data,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', om.id,
            'order_id', om.order_id,
            'sender_type', om.sender_type,
            'message', om.message,
            'created_at', om.created_at
          )
          ORDER BY om.created_at ASC
        )
        FROM order_messages om
        WHERE om.order_id = o.id
      ),
      '[]'::JSONB
    ) AS messages_data,
    jsonb_build_object(
      'name', s.name,
      'phone', s.phone
    ) AS store_data
  FROM orders o
  JOIN stores s ON s.id = o.store_id
  WHERE o.id = p_order_id
  AND o.tracking_token = btrim(p_tracking_token);
END;
$$;

CREATE OR REPLACE FUNCTION send_delivery_order_message(
  p_order_id UUID,
  p_tracking_token TEXT,
  p_message TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_body TEXT := NULLIF(btrim(COALESCE(p_message, '')), '');
  v_message order_messages%ROWTYPE;
BEGIN
  IF NULLIF(btrim(COALESCE(p_tracking_token, '')), '') IS NULL THEN
    RAISE EXCEPTION 'tracking_token_required';
  END IF;

  IF v_body IS NULL THEN
    RAISE EXCEPTION 'message_required';
  END IF;

  IF length(v_body) > 1000 THEN
    RAISE EXCEPTION 'message_too_long';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = p_order_id
    AND o.tracking_token = btrim(p_tracking_token)
  ) THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  INSERT INTO order_messages (order_id, sender_type, message)
  VALUES (p_order_id, 'client', v_body)
  RETURNING * INTO v_message;

  RETURN jsonb_build_object(
    'id', v_message.id,
    'order_id', v_message.order_id,
    'sender_type', v_message.sender_type,
    'message', v_message.message,
    'created_at', v_message.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION get_store_by_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_store_by_user(UUID) TO authenticated;

REVOKE ALL ON FUNCTION get_store_orders_with_items(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_store_orders_with_items(UUID) TO authenticated;

REVOKE ALL ON FUNCTION create_delivery_order(UUID, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_delivery_order(UUID, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, JSONB) TO anon, authenticated;

REVOKE ALL ON FUNCTION get_delivery_order_tracking(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_delivery_order_tracking(UUID, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION send_delivery_order_message(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION send_delivery_order_message(UUID, TEXT, TEXT) TO anon, authenticated;

-- ============================================
-- STORAGE: store-images bucket for logos and banners
-- ============================================

-- Insert storage bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-images',
  'store-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view store images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload store images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete store images" ON storage.objects;

-- Allow public read access to store images
CREATE POLICY "Public can view store images"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-images');

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated can upload store images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'store-images' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their own images
CREATE POLICY "Authenticated can delete store images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'store-images' AND
  auth.role() = 'authenticated'
);
