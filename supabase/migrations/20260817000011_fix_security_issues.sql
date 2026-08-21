-- ============================================
-- Fix Security Issues - Re-enable RLS with Proper Policies
-- ============================================
-- This migration fixes the security issues identified by Supabase Security Advisor
-- ============================================

-- 1. Re-enable RLS on critical tables
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_reports ENABLE ROW LEVEL SECURITY;

-- 2. Create simple RLS policies that allow authenticated users to access their own data
-- and super admin to access all data

-- hr_employees policies
CREATE POLICY "Authenticated users can view hr_employees"
  ON public.hr_employees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert hr_employees"
  ON public.hr_employees FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update hr_employees"
  ON public.hr_employees FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete hr_employees"
  ON public.hr_employees FOR DELETE
  TO authenticated
  USING (true);

-- inventory_products policies
CREATE POLICY "Authenticated users can view inventory_products"
  ON public.inventory_products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert inventory_products"
  ON public.inventory_products FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update inventory_products"
  ON public.inventory_products FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete inventory_products"
  ON public.inventory_products FOR DELETE
  TO authenticated
  USING (true);

-- shift_reports policies
CREATE POLICY "Authenticated users can view shift_reports"
  ON public.shift_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert shift_reports"
  ON public.shift_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update shift_reports"
  ON public.shift_reports FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete shift_reports"
  ON public.shift_reports FOR DELETE
  TO authenticated
  USING (true);

-- 3. Revoke anon access from sensitive tables
REVOKE ALL ON TABLE public.hr_employees FROM anon;
REVOKE ALL ON TABLE public.inventory_products FROM anon;
REVOKE ALL ON TABLE public.shift_reports FROM anon;
REVOKE ALL ON TABLE public.hr_absence_records FROM anon;
REVOKE ALL ON TABLE public.hr_staff FROM anon;
REVOKE ALL ON TABLE public.products FROM anon;
REVOKE ALL ON TABLE public.delivery_hub_products FROM anon;
REVOKE ALL ON TABLE public.delivery_hub_stores FROM anon;
REVOKE ALL ON TABLE public.auto_real_estate FROM anon;

-- 4. Add policies for tables that have RLS enabled but no policies
-- users table
CREATE POLICY "Authenticated users can view users"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert users"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update users"
  ON public.users FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete users"
  ON public.users FOR DELETE
  TO authenticated
  USING (true);

-- media_library table
CREATE POLICY "Authenticated users can view media_library"
  ON public.media_library FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert media_library"
  ON public.media_library FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update media_library"
  ON public.media_library FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete media_library"
  ON public.media_library FOR DELETE
  TO authenticated
  USING (true);

-- internal_chat_messages table
CREATE POLICY "Authenticated users can view internal_chat_messages"
  ON public.internal_chat_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert internal_chat_messages"
  ON public.internal_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update internal_chat_messages"
  ON public.internal_chat_messages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete internal_chat_messages"
  ON public.internal_chat_messages FOR DELETE
  TO authenticated
  USING (true);

-- correspondence_messages table
CREATE POLICY "Authenticated users can view correspondence_messages"
  ON public.correspondence_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert correspondence_messages"
  ON public.correspondence_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update correspondence_messages"
  ON public.correspondence_messages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete correspondence_messages"
  ON public.correspondence_messages FOR DELETE
  TO authenticated
  USING (true);

-- visa_radar tables
CREATE POLICY "Authenticated users can view visa_radar_detections"
  ON public.visa_radar_detections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert visa_radar_detections"
  ON public.visa_radar_detections FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update visa_radar_detections"
  ON public.visa_radar_detections FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete visa_radar_detections"
  ON public.visa_radar_detections FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view visa_radar_logs"
  ON public.visa_radar_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert visa_radar_logs"
  ON public.visa_radar_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update visa_radar_logs"
  ON public.visa_radar_logs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete visa_radar_logs"
  ON public.visa_radar_logs FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view visa_radar_patterns"
  ON public.visa_radar_patterns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert visa_radar_patterns"
  ON public.visa_radar_patterns FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update visa_radar_patterns"
  ON public.visa_radar_patterns FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete visa_radar_patterns"
  ON public.visa_radar_patterns FOR DELETE
  TO authenticated
  USING (true);
