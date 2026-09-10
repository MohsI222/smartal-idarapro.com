-- Update Shift Reports Table with enhanced fields
-- This migration adds operation tracking fields to the shift_reports table

-- Add new columns for operation tracking
ALTER TABLE public.shift_reports 
ADD COLUMN IF NOT EXISTS sales_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS stock_add_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS stock_edit_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS import_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS export_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS delete_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_operations INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS operations_log JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS shift_description TEXT;

-- Create index for faster queries on shift_date and shift_group
CREATE INDEX IF NOT EXISTS idx_shift_reports_date_group ON public.shift_reports(shift_date, shift_group);
