-- ============================================
-- Revoke Anon Table Grants from Sensitive Tables
-- ============================================
-- This migration revokes table-level anon privileges from sensitive tables
-- to ensure complete data protection
-- ============================================

-- Revoke anon privileges from hr_employees
REVOKE INSERT, SELECT, UPDATE, DELETE ON public.hr_employees FROM anon;

-- Revoke anon privileges from inventory_products
REVOKE INSERT, SELECT, UPDATE, DELETE ON public.inventory_products FROM anon;

-- Revoke anon privileges from shift_reports
REVOKE INSERT, SELECT, UPDATE, DELETE ON public.shift_reports FROM anon;

-- Revoke anon privileges from hr_absence_records
REVOKE INSERT, SELECT, UPDATE, DELETE ON public.hr_absence_records FROM anon;

-- Verify the changes
SELECT table_name, grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name IN ('hr_employees', 'inventory_products', 'shift_reports', 'hr_absence_records') 
AND grantee = 'anon' 
AND table_schema = 'public';
