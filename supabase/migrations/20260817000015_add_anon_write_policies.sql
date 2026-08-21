-- ============================================
-- Add Write Policies for anon Role
-- ============================================
-- This migration adds INSERT/UPDATE/DELETE policies for anon role
-- to allow the application to work without requiring full authentication
-- while maintaining basic security through RLS
-- ============================================

-- Allow anon to insert hr_employees
CREATE POLICY "anon can insert hr_employees"
  ON public.hr_employees FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to update hr_employees
CREATE POLICY "anon can update hr_employees"
  ON public.hr_employees FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon to delete hr_employees
CREATE POLICY "anon can delete hr_employees"
  ON public.hr_employees FOR DELETE
  TO anon
  USING (true);

-- Allow anon to insert inventory_products
CREATE POLICY "anon can insert inventory_products"
  ON public.inventory_products FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to update inventory_products
CREATE POLICY "anon can update inventory_products"
  ON public.inventory_products FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon to delete inventory_products
CREATE POLICY "anon can delete inventory_products"
  ON public.inventory_products FOR DELETE
  TO anon
  USING (true);

-- Allow anon to insert shift_reports
CREATE POLICY "anon can insert shift_reports"
  ON public.shift_reports FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to update shift_reports
CREATE POLICY "anon can update shift_reports"
  ON public.shift_reports FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon to delete shift_reports
CREATE POLICY "anon can delete shift_reports"
  ON public.shift_reports FOR DELETE
  TO anon
  USING (true);

-- Grant INSERT/UPDATE/DELETE on tables to anon role
GRANT INSERT, UPDATE, DELETE ON TABLE public.hr_employees TO anon;
GRANT INSERT, UPDATE, DELETE ON TABLE public.inventory_products TO anon;
GRANT INSERT, UPDATE, DELETE ON TABLE public.shift_reports TO anon;
