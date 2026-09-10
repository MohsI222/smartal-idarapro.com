-- POS Agent Product Filters Table
-- This table stores custom product catalogs for each sales rep

CREATE TABLE IF NOT EXISTS public.pos_agent_product_filters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID REFERENCES public.pos_agent_tokens(id) ON DELETE CASCADE,
  employee_id TEXT REFERENCES hr_employees(employee_id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(token_id, product_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pos_agent_product_filters_token_id ON public.pos_agent_product_filters(token_id);
CREATE INDEX IF NOT EXISTS idx_pos_agent_product_filters_employee_id ON public.pos_agent_product_filters(employee_id);
CREATE INDEX IF NOT EXISTS idx_pos_agent_product_filters_user_id ON public.pos_agent_product_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_pos_agent_product_filters_product_id ON public.pos_agent_product_filters(product_id);
CREATE INDEX IF NOT EXISTS idx_pos_agent_product_filters_is_visible ON public.pos_agent_product_filters(is_visible);

-- Enable Row Level Security
ALTER TABLE public.pos_agent_product_filters ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own product filters
CREATE POLICY "Users can view own pos product filters"
  ON public.pos_agent_product_filters FOR SELECT
  TO authenticated
  USING (user_id::text = auth.uid()::text);

-- Policy: Admins can view all product filters
CREATE POLICY "Admins can view all pos product filters"
  ON public.pos_agent_product_filters FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM permissions p
      WHERE p.employee_id::text = auth.uid()::text
      AND p.is_admin = true
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  );

-- Policy: Users can insert their own product filters
CREATE POLICY "Users can insert own pos product filters"
  ON public.pos_agent_product_filters FOR INSERT
  TO authenticated
  WITH CHECK (user_id::text = auth.uid()::text);

-- Policy: Admins can insert product filters
CREATE POLICY "Admins can insert pos product filters"
  ON public.pos_agent_product_filters FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM permissions p
      WHERE p.employee_id::text = auth.uid()::text
      AND p.is_admin = true
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  );

-- Policy: Users can update their own product filters
CREATE POLICY "Users can update own pos product filters"
  ON public.pos_agent_product_filters FOR UPDATE
  TO authenticated
  USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);

-- Policy: Admins can update all product filters
CREATE POLICY "Admins can update all pos product filters"
  ON public.pos_agent_product_filters FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM permissions p
      WHERE p.employee_id::text = auth.uid()::text
      AND p.is_admin = true
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM permissions p
      WHERE p.employee_id::text = auth.uid()::text
      AND p.is_admin = true
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  );

-- Policy: Users can delete their own product filters
CREATE POLICY "Users can delete own pos product filters"
  ON public.pos_agent_product_filters FOR DELETE
  TO authenticated
  USING (user_id::text = auth.uid()::text);

-- Policy: Admins can delete all product filters
CREATE POLICY "Admins can delete all pos product filters"
  ON public.pos_agent_product_filters FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM permissions p
      WHERE p.employee_id::text = auth.uid()::text
      AND p.is_admin = true
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  );

-- Comment on table
COMMENT ON TABLE public.pos_agent_product_filters IS 'Custom product catalogs for sales reps';
