-- Inventory Activity Logs Table
-- This table stores activity logs for inventory operations with proper user isolation
-- Replaces LocalStorage-based activity logs to prevent data leakage

CREATE TABLE IF NOT EXISTS public.inventory_activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  shift_id TEXT NOT NULL,
  shift_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT,
  quantity INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_inventory_activity_logs_user_id ON public.inventory_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_activity_logs_date ON public.inventory_activity_logs(date);
CREATE INDEX IF NOT EXISTS idx_inventory_activity_logs_shift_id ON public.inventory_activity_logs(shift_id);
CREATE INDEX IF NOT EXISTS idx_inventory_activity_logs_timestamp ON public.inventory_activity_logs(timestamp DESC);

-- Enable Row Level Security
ALTER TABLE public.inventory_activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view own activity logs" ON public.inventory_activity_logs;
DROP POLICY IF EXISTS "Users can insert own activity logs" ON public.inventory_activity_logs;
DROP POLICY IF EXISTS "Users can delete own activity logs" ON public.inventory_activity_logs;

-- Create policy to allow users to see their own activity logs
CREATE POLICY "Users can view own activity logs"
  ON public.inventory_activity_logs FOR SELECT
  USING (auth.uid()::text = user_id);

-- Create policy to allow users to insert their own activity logs
CREATE POLICY "Users can insert own activity logs"
  ON public.inventory_activity_logs FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Create policy to allow users to delete their own activity logs
CREATE POLICY "Users can delete own activity logs"
  ON public.inventory_activity_logs FOR DELETE
  USING (auth.uid()::text = user_id);
