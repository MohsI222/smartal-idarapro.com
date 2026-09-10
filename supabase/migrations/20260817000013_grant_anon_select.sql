-- ============================================
-- Grant SELECT to anon Role
-- ============================================
-- This migration grants SELECT access to anon role
-- to allow read-only access for basic functionality
-- ============================================

-- Grant SELECT on hr_employees
GRANT SELECT ON TABLE public.hr_employees TO anon;

-- Grant SELECT on inventory_products
GRANT SELECT ON TABLE public.inventory_products TO anon;

-- Grant SELECT on shift_reports
GRANT SELECT ON TABLE public.shift_reports TO anon;

-- Grant SELECT on hr_absence_records
GRANT SELECT ON TABLE public.hr_absence_records TO anon;

-- Grant SELECT on hr_staff
GRANT SELECT ON TABLE public.hr_staff TO anon;

-- Grant SELECT on products
GRANT SELECT ON TABLE public.products TO anon;

-- Grant SELECT on delivery_hub_products
GRANT SELECT ON TABLE public.delivery_hub_products TO anon;

-- Grant SELECT on delivery_hub_stores
GRANT SELECT ON TABLE public.delivery_hub_stores TO anon;

-- Grant SELECT on auto_real_estate
GRANT SELECT ON TABLE public.auto_real_estate TO anon;
