# إصلاح قسم المخزون والمبيعات - الخطة التنفيذية

> **للمنفذين الآليين:** يجب استخدام مهارة `executing-plans` لتنفيذ المهام خطوة بخطوة.

**الهدف:** إصلاح فشل حفظ معلومات العميل، تسجيل التقارير، وعدم ظهور المنتجات بعد الاستيراد في موديول `InventoryPosModule.tsx`.

**المقاربة:** توحيد مسميات الحقول في قاعدة البيانات (Supabase) مع الكود، وإصلاح مراجع المتغيرات المكسورة، وتوحيد منطق تحديث الحالة (State) بعد العمليات الذكية.

**التقنيات:** React, Supabase, TypeScript.

---

### Task 1: توحيد حقول التقارير ومعلومات العميل
**الملفات:** 
- تعديل: `src/pages/modules/InventoryPosModule.tsx`

- [ ] **Step 1: تصحيح منطق حفظ العميل (Save Customer Info)**
تغيير `customer_number` إلى `customer_phone` في دالة الحفظ (سطر ~3594 وما حوله) لتتطابق مع الـ Schema.

- [ ] **Step 2: تعريف المتغيرات المفقودة**
إضافة تعريفات لـ `manualShiftStartTime` و `manualShiftEndTime` و `shiftWeek` في الـ State لتفادي أخطاء الـ Reference (سطر ~2910 وما حوله).

- [ ] **Step 3: توحيد دالة `logShiftOperation`**
تأكيد إرسال `customer_phone` بدل `customer_number` في تحديثات التقارير.

### Task 2: إصلاح ظهور المنتجات بعد الاستيراد والمسح الذكي
**الملفات:** 
- تعديل: `src/pages/modules/InventoryPosModule.tsx`

- [ ] **Step 1: توحيد تحديث قائمة المنتجات**
تعديل `upsertImportedProducts` و `applyStockVisionItems` للتأكد من أنها تنادي على `setProducts` و `setInventoryItems` معاً لضمان ظهور البيانات في جدول الجرد.

- [ ] **Step 2: إصلاح الـ Dependency Array في `useMemo`**
تأكيد أن `inventorySourceRows` و `filteredInventoryRows` تعتمد على `products` و `inventoryItems` بشكل صحيح لتعكس التغييرات فوراً.

### Task 3: تنظيف المراجع المكسورة (Compile Fixes)
**الملفات:** 
- تعديل: `src/pages/modules/InventoryPosModule.tsx`
- تعديل: `src/features/inventory/components/InventoryDashboardSection.tsx`

- [ ] **Step 1: إصلاح الـ Props في المكونات الفرعية**
تحديث `InventoryDashboardSection` لاستقبال القيم الرقمية (Number) بدل النصوص (String) في حقول التعديل لتفادي أخطاء النوع (Type Mismatch).

- [ ] **Step 2: إزالة الكود المكرر**
استيراد الأنواع والثوابت من `src/features/inventory/` بدل تعريفها محلياً داخل الموديول الرئيسي.
