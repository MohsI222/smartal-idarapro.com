-- ============================================================================
-- Create Demo Store for Public Access
-- This creates a default demo-store that can be accessed via /m/demo-store
-- ============================================================================

-- Insert demo store if it doesn't exist
INSERT INTO public.delivery_hub_stores (id, user_id, name, slug, tagline, theme, banner_url, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'متجر التميز والسرعة',
  'demo-store',
  'أسرع توصيل بأفضل جودة 🚀',
  'neon-modern',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=60',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Insert demo products using the actual store_id from the demo-store
-- This uses a subquery to get the correct store_id to avoid foreign key constraint errors
INSERT INTO public.delivery_hub_products (id, store_id, title, category, description, price, original_price, image_url, in_stock, sort_order, stock_quantity, low_stock_threshold)
SELECT 
  '00000000-0000-0000-0000-000000000002',
  id,
  'برجر لحم مشوي فاخر',
  'أطباق رئيسية',
  'برجر لحم طازج مع جبنة وصلصة خاصة',
  45,
  60,
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=60',
  true,
  0,
  50,
  5
FROM public.delivery_hub_stores
WHERE slug = 'demo-store'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.delivery_hub_products (id, store_id, title, category, description, price, original_price, image_url, in_stock, sort_order, stock_quantity, low_stock_threshold)
SELECT 
  '00000000-0000-0000-0000-000000000003',
  id,
  'بيتزا مارغريتا',
  'بيتزا',
  'عجينة رقيقة مع جبنة موزاريلا وصلصة طماطم طازجة',
  65,
  null,
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=60',
  true,
  1,
  30,
  5
FROM public.delivery_hub_stores
WHERE slug = 'demo-store'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.delivery_hub_products (id, store_id, title, category, description, price, original_price, image_url, in_stock, sort_order, stock_quantity, low_stock_threshold)
SELECT 
  '00000000-0000-0000-0000-000000000004',
  id,
  'عصير طبيعي مثلج',
  'مشروبات',
  'عصير فواكه طازج بدون سكر مضاف',
  20,
  25,
  'https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=800&q=60',
  true,
  2,
  100,
  10
FROM public.delivery_hub_stores
WHERE slug = 'demo-store'
ON CONFLICT (id) DO NOTHING;
