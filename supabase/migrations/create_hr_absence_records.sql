-- Create hr_absence_records table
CREATE TABLE IF NOT EXISTS public.hr_absence_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT NOT NULL,
  return_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.hr_absence_records ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see their own absence records
CREATE POLICY "Users can view own absence records"
  ON public.hr_absence_records FOR SELECT
  USING (auth.uid()::text = user_id);

-- Create policy to allow users to insert their own absence records
CREATE POLICY "Users can insert own absence records"
  ON public.hr_absence_records FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Create policy to allow users to delete their own absence records
CREATE POLICY "Users can delete own absence records"
  ON public.hr_absence_records FOR DELETE
  USING (auth.uid()::text = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_hr_absence_records_user_id ON public.hr_absence_records(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_absence_records_employee_id ON public.hr_absence_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_absence_records_created_at ON public.hr_absence_records(created_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.hr_absence_records
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
