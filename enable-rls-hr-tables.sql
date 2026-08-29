-- Enable RLS on HR tables
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employees FORCE ROW LEVEL SECURITY;

ALTER TABLE public.hr_absence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_absence_records FORCE ROW LEVEL SECURITY;

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('hr_employees', 'hr_absence_records');
