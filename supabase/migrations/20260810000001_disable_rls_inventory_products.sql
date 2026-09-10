-- Disable RLS for inventory_products temporarily
-- The application handles user_id filtering at the application level
-- This is necessary because the app uses a custom auth system with user_id from the backend, not Supabase auth.uid()

ALTER TABLE public.inventory_products DISABLE ROW LEVEL SECURITY;
