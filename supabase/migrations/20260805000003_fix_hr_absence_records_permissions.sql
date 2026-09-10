-- ============================================
-- Fix permissions for hr_absence_records table
-- ============================================
-- Open all permissions to allow adding absence records
-- ============================================

-- ============================================
-- 1. جعل جميع الحقول اختيارية ما عدا الاسم
-- ============================================

-- إزالة أي قيود ربط إجباري قديمة تمنع الحفظ
ALTER TABLE public.hr_absence_records DROP CONSTRAINT IF EXISTS hr_absence_records_user_id_fkey;

-- جعل الحقول كاملة اختيارية
ALTER TABLE public.hr_absence_records ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.hr_absence_records ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE public.hr_absence_records ALTER COLUMN from_date DROP NOT NULL;
ALTER TABLE public.hr_absence_records ALTER COLUMN to_date DROP NOT NULL;
ALTER TABLE public.hr_absence_records ALTER COLUMN reason DROP NOT NULL;

-- ============================================
-- 2. فتح صلاحيات القراءة والإضافة والتعديل والحذف
-- ============================================

GRANT ALL ON TABLE public.hr_absence_records TO anon, authenticated, service_role, public;

ALTER TABLE public.hr_absence_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to absence records" ON public.hr_absence_records;

-- سياسة بسيطة وشاملة تسمح بالحفظ والتعديل والحذف بدون أي معوقات
CREATE POLICY "Allow full access to absence records" 
  ON public.hr_absence_records 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
