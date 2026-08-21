-- Add status column to pos_invoices table
ALTER TABLE pos_invoices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
