-- POS Agent Attendance Table
-- This table tracks clock-in/clock-out for sales reps

CREATE TABLE IF NOT EXISTS public.pos_agent_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID REFERENCES public.pos_agent_tokens(id) ON DELETE CASCADE,
  employee_id TEXT REFERENCES hr_employees(employee_id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  clock_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out_time TIMESTAMPTZ,
  work_duration_minutes INTEGER,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pos_agent_attendance_token_id ON public.pos_agent_attendance(token_id);
CREATE INDEX IF NOT EXISTS idx_pos_agent_attendance_employee_id ON public.pos_agent_attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_pos_agent_attendance_user_id ON public.pos_agent_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_pos_agent_attendance_clock_in_time ON public.pos_agent_attendance(clock_in_time);

-- Enable Row Level Security
ALTER TABLE public.pos_agent_attendance ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own attendance
CREATE POLICY "Users can view own pos attendance"
  ON public.pos_agent_attendance FOR SELECT
  TO authenticated
  USING (user_id::text = auth.uid()::text);

-- Policy: Admins can view all attendance
CREATE POLICY "Admins can view all pos attendance"
  ON public.pos_agent_attendance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM permissions p
      WHERE p.employee_id::text = auth.uid()::text
      AND p.is_admin = true
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  );

-- Policy: Users can insert their own attendance
CREATE POLICY "Users can insert own pos attendance"
  ON public.pos_agent_attendance FOR INSERT
  TO authenticated
  WITH CHECK (user_id::text = auth.uid()::text);

-- Policy: Admins can insert attendance
CREATE POLICY "Admins can insert pos attendance"
  ON public.pos_agent_attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM permissions p
      WHERE p.employee_id::text = auth.uid()::text
      AND p.is_admin = true
    )
    OR auth.jwt() ->> 'email' = 'lahcenm534@gmail.com'
  );

-- Policy: Users can update their own attendance
CREATE POLICY "Users can update own pos attendance"
  ON public.pos_agent_attendance FOR UPDATE
  TO authenticated
  USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);

-- Policy: Admins can update all attendance
CREATE POLICY "Admins can update all pos attendance"
  ON public.pos_agent_attendance FOR UPDATE
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

-- Comment on table
COMMENT ON TABLE public.pos_agent_attendance IS 'Clock-in/clock-out tracking for sales reps';
