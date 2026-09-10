-- ============================================
-- Remove Remaining Anon Policies from Sensitive Tables
-- ============================================
-- This migration removes any remaining anon access from sensitive tables
-- to ensure data protection and prevent data leakage between accounts
-- ============================================

-- Remove anon policies from products
DROP POLICY IF EXISTS "anon can view products" ON public.products;

-- Remove anon policies from orders (keep store owner policies)
-- Note: orders already have proper store-based isolation

-- Remove anon policies from order_items
DROP POLICY IF EXISTS "order_items_public_insert" ON public.order_items;
DROP POLICY IF EXISTS "order_items_public_select" ON public.order_items;

-- Remove anon policies from order_messages
DROP POLICY IF EXISTS "order_messages_insert" ON public.order_messages;
DROP POLICY IF EXISTS "order_messages_select" ON public.order_messages;

-- Verify the changes
SELECT tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE tablename IN ('products', 'order_items', 'order_messages') 
AND schemaname = 'public'
AND roles::text LIKE '%anon%'
ORDER BY tablename, policyname;
