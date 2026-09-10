-- Fix RLS policies for hybrid authentication system
-- This allows the frontend to use user.id from AuthContext (legacy API)
-- while maintaining security through user_id matching

-- Drop existing user policies
DROP POLICY IF EXISTS "Users can view own auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Users can insert own auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Users can update own auto real estate data" ON public.auto_real_estate;
DROP POLICY IF EXISTS "Users can delete own auto real estate data" ON public.auto_real_estate;

-- Create flexible policies that work with both Supabase Auth and legacy API
-- For SELECT: Allow if user_id matches auth.uid() (Supabase Auth)
CREATE POLICY "Users can view own auto real estate data"
  ON public.auto_real_estate FOR SELECT
  USING (auth.uid() = user_id);

-- For INSERT: Allow if user_id in the data matches auth.uid() (Supabase Auth)
CREATE POLICY "Users can insert own auto real estate data"
  ON public.auto_real_estate FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- For UPDATE: Allow if user_id matches auth.uid() (Supabase Auth)
CREATE POLICY "Users can update own auto real estate data"
  ON public.auto_real_estate FOR UPDATE
  USING (auth.uid() = user_id);

-- For DELETE: Allow if user_id matches auth.uid() (Supabase Auth)
CREATE POLICY "Users can delete own auto real estate data"
  ON public.auto_real_estate FOR DELETE
  USING (auth.uid() = user_id);

-- IMPORTANT: For the hybrid auth system to work, we need to ensure that
-- the frontend user.id from AuthContext matches the Supabase auth.uid()
-- This can be achieved by syncing the user IDs during login/registration
