-- Add user-specific policies for tables that have RLS enabled but no policies
-- This ensures data isolation for these tables

-- logistics_queue (has user_id column)
CREATE POLICY "Users can view own logistics_queue"
  ON public.logistics_queue FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own logistics_queue"
  ON public.logistics_queue FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own logistics_queue"
  ON public.logistics_queue FOR UPDATE
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own logistics_queue"
  ON public.logistics_queue FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- production_requests (has user_id column)
CREATE POLICY "Users can view own production_requests"
  ON public.production_requests FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own production_requests"
  ON public.production_requests FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own production_requests"
  ON public.production_requests FOR UPDATE
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own production_requests"
  ON public.production_requests FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- delivery_hub_orders (uses store_id instead of user_id - handled via delivery_hub_owners)
-- This table should be accessed through the delivery_hub_owners relationship
-- No direct user policies needed as it's managed through store ownership

-- Verify policies were added
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('logistics_queue', 'production_requests')
ORDER BY tablename, policyname;
