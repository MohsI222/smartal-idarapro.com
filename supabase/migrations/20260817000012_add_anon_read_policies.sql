-- ============================================
-- Add Read-Only Policies for anon Role
-- ============================================
-- This migration adds read-only policies for anon role to allow
-- basic functionality while maintaining security
-- ============================================

-- Allow anon to read hr_employees (read-only for basic functionality)
CREATE POLICY "anon can view hr_employees"
  ON public.hr_employees FOR SELECT
  TO anon
  USING (true);

-- Allow anon to read inventory_products (read-only for basic functionality)
CREATE POLICY "anon can view inventory_products"
  ON public.inventory_products FOR SELECT
  TO anon
  USING (true);

-- Allow anon to read shift_reports (read-only for basic functionality)
CREATE POLICY "anon can view shift_reports"
  ON public.shift_reports FOR SELECT
  TO anon
  USING (true);

-- Allow anon to read hr_absence_records (read-only for basic functionality)
CREATE POLICY "anon can view hr_absence_records"
  ON public.hr_absence_records FOR SELECT
  TO anon
  USING (true);

-- Allow anon to read hr_staff (read-only for basic functionality)
CREATE POLICY "anon can view hr_staff"
  ON public.hr_staff FOR SELECT
  TO anon
  USING (true);

-- Allow anon to read products (read-only for basic functionality)
CREATE POLICY "anon can view products"
  ON public.products FOR SELECT
  TO anon
  USING (true);

-- Allow anon to read delivery_hub_products (read-only for basic functionality)
CREATE POLICY "anon can view delivery_hub_products"
  ON public.delivery_hub_products FOR SELECT
  TO anon
  USING (true);

-- Allow anon to read delivery_hub_stores (read-only for basic functionality)
CREATE POLICY "anon can view delivery_hub_stores"
  ON public.delivery_hub_stores FOR SELECT
  TO anon
  USING (true);

-- Allow anon to read auto_real_estate (read-only for basic functionality)
CREATE POLICY "anon can view auto_real_estate"
  ON public.auto_real_estate FOR SELECT
  TO anon
  USING (true);
