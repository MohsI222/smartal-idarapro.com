-- ============================================
-- Final Comprehensive Database Update
-- ============================================
-- Successfully applied on 2026-08-05
-- Author: Lahcen El Moutaouakil (lahcenm534@gmail.com)
-- All fields optional except name, all permissions open
-- ============================================

-- ============================================
-- 1. جعل جميع الحقول اختيارية ما عدا الاسم والشركة (user_id)
-- ============================================

-- إزالة أي قيود ربط إجباري قديمة تمنع الحفظ
ALTER TABLE public.hr_employees DROP CONSTRAINT IF EXISTS hr_employees_user_id_fkey;
ALTER TABLE public.hr_employees DROP CONSTRAINT IF EXISTS hr_employees_employee_id_key;
DROP INDEX IF EXISTS public.hr_employees_employee_id_key;

-- جعل الحقول كاملة اختيارية (ما عدا الاسم)
ALTER TABLE public.hr_employees ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.hr_employees ALTER COLUMN national_id DROP NOT NULL;
ALTER TABLE public.hr_employees ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE public.hr_employees ALTER COLUMN work_number DROP NOT NULL;
ALTER TABLE public.hr_employees ALTER COLUMN role DROP NOT NULL;
ALTER TABLE public.hr_employees ALTER COLUMN salary DROP NOT NULL;
ALTER TABLE public.hr_employees ALTER COLUMN contract_type DROP NOT NULL;
ALTER TABLE public.hr_employees ALTER COLUMN start_date DROP NOT NULL;

-- ============================================
-- 2. فتح صلاحيات القراءة والإضافة والتعديل والحذف
-- ============================================

GRANT ALL ON TABLE public.hr_employees TO anon, authenticated, service_role, public;

ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to employees" ON public.hr_employees;

-- سياسة بسيطة وشاملة تسمح بالحفظ والتعديل والحذف بدون أي معوقات
CREATE POLICY "Allow full access to employees" 
  ON public.hr_employees 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
