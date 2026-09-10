-- Exported Documents Table
-- This table stores exported documents with proper user isolation
-- Replaces LocalStorage-based document logs to prevent data leakage

CREATE TABLE IF NOT EXISTS public.exported_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  document_kind TEXT NOT NULL, -- 'pdf', 'excel', 'word', etc.
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER,
  export_timestamp TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_exported_documents_user_id ON public.exported_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_exported_documents_kind ON public.exported_documents(document_kind);
CREATE INDEX IF NOT EXISTS idx_exported_documents_timestamp ON public.exported_documents(export_timestamp DESC);

-- Enable Row Level Security
ALTER TABLE public.exported_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view own exported documents" ON public.exported_documents;
DROP POLICY IF EXISTS "Users can insert own exported documents" ON public.exported_documents;
DROP POLICY IF EXISTS "Users can delete own exported documents" ON public.exported_documents;

-- Create policy to allow users to see their own exported documents
CREATE POLICY "Users can view own exported documents"
  ON public.exported_documents FOR SELECT
  USING (auth.uid()::text = user_id);

-- Create policy to allow users to insert their own exported documents
CREATE POLICY "Users can insert own exported documents"
  ON public.exported_documents FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Create policy to allow users to delete their own exported documents
CREATE POLICY "Users can delete own exported documents"
  ON public.exported_documents FOR DELETE
  USING (auth.uid()::text = user_id);
