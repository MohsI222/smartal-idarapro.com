-- Remove dangerous policies from key tables
-- These policies allow any authenticated user to bypass data isolation

-- logistics_queue
DROP POLICY IF EXISTS "Allow authenticated access for logistics_queue" ON public.logistics_queue;
DROP POLICY IF EXISTS "Authenticated users can insert logistics_queue" ON public.logistics_queue;
DROP POLICY IF EXISTS "Authenticated users can update logistics_queue" ON public.logistics_queue;
DROP POLICY IF EXISTS "Authenticated users can view logistics_queue" ON public.logistics_queue;
DROP POLICY IF EXISTS "Enable delete for authenticated users on logistics_queue" ON public.logistics_queue;

-- production_requests
DROP POLICY IF EXISTS "Authenticated users can delete production_requests" ON public.production_requests;
DROP POLICY IF EXISTS "Authenticated users can insert production_requests" ON public.production_requests;
DROP POLICY IF EXISTS "Authenticated users can update production_requests" ON public.production_requests;
DROP POLICY IF EXISTS "Authenticated users can view production_requests" ON public.production_requests;

-- delivery_hub_products
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.delivery_hub_products;
DROP POLICY IF EXISTS "Allow authenticated access for delivery_hub_products" ON public.delivery_hub_products;
DROP POLICY IF EXISTS "delivery_hub_products_public_select" ON public.delivery_hub_products;

-- delivery_hub_orders
DROP POLICY IF EXISTS "delivery_hub_orders_public_insert" ON public.delivery_hub_orders;
DROP POLICY IF EXISTS "delivery_hub_orders_public_select" ON public.delivery_hub_orders;

-- delivery_hub_stores
DROP POLICY IF EXISTS "Allow all for authenticated users on delivery_hub_stores" ON public.delivery_hub_stores;
DROP POLICY IF EXISTS "Allow authenticated access for delivery_hub_stores" ON public.delivery_hub_stores;
DROP POLICY IF EXISTS "delivery_hub_stores_public_select_active" ON public.delivery_hub_stores;

-- permissions (keep only user-specific and super admin policies)
DROP POLICY IF EXISTS "Admin can manage all permissions" ON public.permissions;
DROP POLICY IF EXISTS "Admin can view all permissions" ON public.permissions;
DROP POLICY IF EXISTS "Allow read permissions for authenticated users" ON public.permissions;
DROP POLICY IF EXISTS "Secure access to permissions" ON public.permissions;
DROP POLICY IF EXISTS "Super admin can update all permissions" ON public.permissions;
DROP POLICY IF EXISTS "Super admin can view all permissions" ON public.permissions;
DROP POLICY IF EXISTS "Users can read permissions" ON public.permissions;

-- products (keep only user-specific policies)
DROP POLICY IF EXISTS "Allow full access to products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
DROP POLICY IF EXISTS "Public can view available products" ON public.products;
DROP POLICY IF EXISTS "products_owner_write" ON public.products;
DROP POLICY IF EXISTS "products_public_select" ON public.products;

-- Verify dangerous policies were removed
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND (
  policyname ILIKE '%all%' OR
  policyname ILIKE '%public%' OR
  policyname ILIKE '%authenticated%' OR
  cmd = 'ALL'
)
ORDER BY tablename, policyname;
