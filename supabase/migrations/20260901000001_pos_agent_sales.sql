-- POS Agent Sales Table
-- This table stores sales made by sales reps through the standalone POS app

CREATE TABLE IF NOT EXISTS public.pos_agent_sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID REFERENCES public.pos_agent_tokens(id) ON DELETE CASCADE,
  employee_id TEXT REFERENCES hr_employees(employee_id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name TEXT,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  paid_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  credit_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  status TEXT DEFAULT 'completed',
  lines_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pos_agent_sales_token_id ON public.pos_agent_sales(token_id);
CREATE INDEX IF NOT EXISTS idx_pos_agent_sales_employee_id ON public.pos_agent_sales(employee_id);
CREATE INDEX IF NOT EXISTS idx_pos_agent_sales_user_id ON public.pos_agent_sales(user_id);
CREATE INDEX IF NOT EXISTS idx_pos_agent_sales_sale_date ON public.pos_agent_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_pos_agent_sales_status ON public.pos_agent_sales(status);

-- Enable Row Level Security
ALTER TABLE public.pos_agent_sales ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own sales
CREATE POLICY "Users can view own pos sales"
  ON public.pos_agent_sales FOR SELECT
  TO authenticated
  USING (user_id::text = auth.uid()::text);

-- Policy: Admins can view all sales
CREATE POLICY "Admins can view all pos sales"
  ON public.pos_agent_sales FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM permissions p
      WHERE p.employee_id::text = auth.uid()::text
      AND p.is_admin = true
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  );

-- Policy: Users can insert their own sales
CREATE POLICY "Users can insert own pos sales"
  ON public.pos_agent_sales FOR INSERT
  TO authenticated
  WITH CHECK (user_id::text = auth.uid()::text);

-- Policy: Admins can insert sales
CREATE POLICY "Admins can insert pos sales"
  ON public.pos_agent_sales FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM permissions p
      WHERE p.employee_id::text = auth.uid()::text
      AND p.is_admin = true
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  );

-- Policy: Users can update their own sales
CREATE POLICY "Users can update own pos sales"
  ON public.pos_agent_sales FOR UPDATE
  TO authenticated
  USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);

-- Policy: Admins can update all sales
CREATE POLICY "Admins can update all pos sales"
  ON public.pos_agent_sales FOR UPDATE
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

-- Policy: Users can delete their own sales
CREATE POLICY "Users can delete own pos sales"
  ON public.pos_agent_sales FOR DELETE
  TO authenticated
  USING (user_id::text = auth.uid()::text);

-- Policy: Admins can delete all sales
CREATE POLICY "Admins can delete all pos sales"
  ON public.pos_agent_sales FOR DELETE
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
COMMENT ON TABLE public.pos_agent_sales IS 'Sales made by sales reps through standalone POS app';
