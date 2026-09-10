-- ============================================
-- Final Working RLS Security Migration
-- ============================================
-- Successfully applied on 2026-08-05
-- Author: Lahcen El Moutaouakil (lahcenm534@gmail.com)
-- ============================================

-- ============================================
-- 1. FORCE ENABLE RLS & REVOKE PUBLIC ACCESS
-- ============================================

ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employees FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hr_employees FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hr_employees TO authenticated;

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.permissions FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.permissions TO authenticated;

-- ============================================
-- 2. RLS POLICIES FOR HR_EMPLOYEES (FIXED CASTING)
-- ============================================

DROP POLICY IF EXISTS "Users can view own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can insert own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can update own employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Users can delete own employees" ON public.hr_employees;

CREATE POLICY "Users can view own employees"
  ON public.hr_employees FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own employees"
  ON public.hr_employees FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own employees"
  ON public.hr_employees FOR UPDATE
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own employees"
  ON public.hr_employees FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- ============================================
-- 3. RLS POLICIES FOR PERMISSIONS (FIXED CASTING)
-- ============================================

DROP POLICY IF EXISTS "Users can view own permissions" ON public.permissions;
DROP POLICY IF EXISTS "Users can insert own permissions" ON public.permissions;
DROP POLICY IF EXISTS "Users can update own permissions" ON public.permissions;
DROP POLICY IF EXISTS "Users can delete own permissions" ON public.permissions;

CREATE POLICY "Users can view own permissions"
  ON public.permissions FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own permissions"
  ON public.permissions FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own permissions"
  ON public.permissions FOR UPDATE
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own permissions"
  ON public.permissions FOR DELETE
  USING (auth.uid()::text = user_id::text);
