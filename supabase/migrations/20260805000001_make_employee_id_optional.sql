-- ============================================
-- Final Working RLS & Employee ID Fix Migration
-- ============================================
-- Successfully applied on 2026-08-05
-- Author: Lahcen El Moutaouakil (lahcenm534@gmail.com)
-- ============================================

-- ============================================
-- 1. MAKE EMPLOYEE_ID OPTIONAL (SAFE VERSION)
-- ============================================

-- إزالة أي قيود تميّز قديمة لمنع التعارض
ALTER TABLE public.hr_employees DROP CONSTRAINT IF EXISTS hr_employees_employee_id_key;
DROP INDEX IF EXISTS public.hr_employees_employee_id_key;

-- تحويل النصوص الفارغة إلى NULL
UPDATE public.hr_employees SET employee_id = NULL WHERE employee_id = '' OR employee_id = ' ';

-- جعل العمود اختياري (DROP NOT NULL)
ALTER TABLE public.hr_employees ALTER COLUMN employee_id DROP NOT NULL;

-- ============================================
-- 2. FORCE ENABLE RLS & REVOKE PUBLIC ACCESS
-- (Fixes Security Advisor 3 Warnings)
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
-- 3. RLS POLICIES FOR HR_EMPLOYEES (FIXED CASTING)
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
-- 4. RLS POLICIES FOR PERMISSIONS (FIXED CASTING)
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
