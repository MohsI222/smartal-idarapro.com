-- ============================================
-- Grant Access to anon Role for Supabase Client
-- ============================================
-- This migration grants access to the anon role which is used by Supabase client
-- when no authentication is provided
-- ============================================

-- Grant access to hr_employees
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON TABLE public.hr_employees TO anon;

-- Grant access to inventory_products
GRANT ALL ON TABLE public.inventory_products TO anon;

-- Grant access to shift_reports
GRANT ALL ON TABLE public.shift_reports TO anon;

-- Grant access to hr_absence_records
GRANT ALL ON TABLE public.hr_absence_records TO anon;
