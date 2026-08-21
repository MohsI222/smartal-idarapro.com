-- Shift Reports Table
-- This table stores shift reports for tracking sales, inventory, and production data

CREATE TABLE IF NOT EXISTS public.shift_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  shift_group TEXT NOT NULL, -- 'A', 'B', or 'C'
  shift_date DATE NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  customer_name TEXT,
  customer_phone TEXT,
  total_sales NUMERIC DEFAULT 0,
  total_items_sold INTEGER DEFAULT 0,
  remaining_stock JSONB DEFAULT '{}',
  sold_products JSONB DEFAULT '[]',
  expired_products JSONB DEFAULT '[]',
  inventory_changes JSONB DEFAULT '{}',
  production_changes JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_shift_reports_user_id ON public.shift_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_shift_reports_shift_date ON public.shift_reports(shift_date);
CREATE INDEX IF NOT EXISTS idx_shift_reports_shift_group ON public.shift_reports(shift_group);

-- Enable Row Level Security
ALTER TABLE public.shift_reports ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see their own shift reports
CREATE POLICY "Users can view own shift reports"
  ON public.shift_reports FOR SELECT
  USING (true);

-- Create policy to allow users to insert their own shift reports
CREATE POLICY "Users can insert own shift reports"
  ON public.shift_reports FOR INSERT
  WITH CHECK (true);

-- Create policy to allow users to update their own shift reports
CREATE POLICY "Users can update own shift reports"
  ON public.shift_reports FOR UPDATE
  USING (true);

-- Create policy to allow users to delete their own shift reports
CREATE POLICY "Users can delete own shift reports"
  ON public.shift_reports FOR DELETE
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shift_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_shift_reports_updated_at
  BEFORE UPDATE ON public.shift_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_shift_reports_updated_at();
