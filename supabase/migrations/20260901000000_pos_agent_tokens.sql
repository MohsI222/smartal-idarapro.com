-- POS Agent Tokens Table
-- This table stores secure tokens for sales reps to access the standalone POS app

CREATE TABLE IF NOT EXISTS public.pos_agent_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id TEXT REFERENCES hr_employees(employee_id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pos_agent_tokens_token ON public.pos_agent_tokens(token);
CREATE INDEX IF NOT EXISTS idx_pos_agent_tokens_user_id ON public.pos_agent_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_pos_agent_tokens_employee_id ON public.pos_agent_tokens(employee_id);
CREATE INDEX IF NOT EXISTS idx_pos_agent_tokens_is_active ON public.pos_agent_tokens(is_active);

-- Enable Row Level Security
ALTER TABLE public.pos_agent_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own tokens
CREATE POLICY "Users can view own pos tokens"
  ON public.pos_agent_tokens FOR SELECT
  TO authenticated
  USING (user_id::text = auth.uid()::text);

-- Policy: Admins can view all tokens
CREATE POLICY "Admins can view all pos tokens"
  ON public.pos_agent_tokens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM permissions p
      WHERE p.employee_id::text = auth.uid()::text
      AND p.is_admin = true
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  );

-- Policy: Users can insert their own tokens
CREATE POLICY "Users can insert own pos tokens"
  ON public.pos_agent_tokens FOR INSERT
  TO authenticated
  WITH CHECK (user_id::text = auth.uid()::text);

-- Policy: Admins can insert tokens
CREATE POLICY "Admins can insert pos tokens"
  ON public.pos_agent_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM permissions p
      WHERE p.employee_id::text = auth.uid()::text
      AND p.is_admin = true
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  );

-- Policy: Users can update their own tokens
CREATE POLICY "Users can update own pos tokens"
  ON public.pos_agent_tokens FOR UPDATE
  TO authenticated
  USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);

-- Policy: Admins can update all tokens
CREATE POLICY "Admins can update all pos tokens"
  ON public.pos_agent_tokens FOR UPDATE
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

-- Policy: Users can delete their own tokens
CREATE POLICY "Users can delete own pos tokens"
  ON public.pos_agent_tokens FOR DELETE
  TO authenticated
  USING (user_id::text = auth.uid()::text);

-- Policy: Admins can delete all tokens
CREATE POLICY "Admins can delete all pos tokens"
  ON public.pos_agent_tokens FOR DELETE
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
COMMENT ON TABLE public.pos_agent_tokens IS 'Secure tokens for sales reps to access standalone POS app';
