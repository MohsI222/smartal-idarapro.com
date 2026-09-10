# تفعيل المزامنة الفورية في الوقت الحقيقي (Real-time Live Sync)

## نظرة عامة

تم تفعيل المزامنة الفورية في الوقت الحقيقي بين مختلف الأجهزة المفتوحة لنفس الحساب. إذا تم إضافة أو تعديل أو حذف أي طلب أو منتج أو موظف أو أي بيان في جهاز، سيظهر التغيير فوراً في الجهاز الآخر بدون الحاجة لعمل Refresh/تحديث للصفحة.

## 🔒 الأمان وعزل البيانات (Security & Data Isolation)

### قيد أمني مهم
جميع Realtime Subscriptions مُصفّاة حسب `user_id` لضمان عزل البيانات بين المستخدمين. هذا يعني:

- ✅ **ممنوع منعاً كلياً** تسريب أو إظهار بيانات زبون أو متجر لمستخدم آخر
- ✅ كل مستخدم يرى فقط بياناته الخاصة (User/Tenant Isolation)
- ✅ يتم تطبيق التصفية `user_id=eq.{userId}` في جميع الاشتراكات
- ✅ RLS Policies (Row Level Security) تضمن الأمان على مستوى قاعدة البيانات

### الجداول المحمية بـ user_id
- `inventory` - تصفية حسب `user_id`
- `production_requests` - تصفية حسب `user_id`
- `logistics_queue` - تصفية حسب `user_id`
- `hr_employees` - تصفية حسب `user_id`
- `delivery_hub_stores` - تصفية حسب `user_id`
- `delivery_hub_products` - تصفية حسب `store_id`
- `delivery_hub_orders` - تصفية حسب `store_id`
- `wedding_invitations` - تصفية حسب `user_id`

### كيف يعمل العزل الأمني
```typescript
// مثال: الاشتراك في جدول inventory مع تصفية user_id
useInventoryRealtime(
  user?.id || "",  // user_id من الـ Auth context
  onInsert,
  onUpdate,
  onDelete,
  isSupabaseConfigured
);

// هذا يولد filter: user_id=eq.{userId}
// مما يضمن أن المستخدم يرى فقط بياناته الخاصة
```

## الميزات المفعّلة

### 📦 Inventory/POS (إدارة المخزون ونقاط البيع)
- **المخزون**: مزامنة فورية لجدول `inventory` (محمي بـ user_id)
- **طلبات الإنتاج**: مزامنة فورية لجدول `production_requests` (محمي بـ user_id)
- **قائمة الخدمات اللوجستية**: مزامنة فورية لجدول `logistics_queue` (محمي بـ user_id)
- **المنتجات**: مزامنة فورية لجدول `inventory_products` (محمي بـ user_id)

### 🚚 Delivery Hub (رادار الطلبات والتوصيل)
- **الطلبات**: مزامنة فورية للطلبات الجديدة والتحديثات على الحالة (محمي بـ store_id)
- **المنتجات**: مزامنة فورية للمنتجات المضافة/المعدلة/المحذوفة (محمي بـ store_id)
- **المتاجر**: مزامنة فورية لجدول `delivery_hub_stores` (محمي بـ user_id)

### 🚛 Transport Logistics (النقل واللوجيستيك)
- **قائمة الخدمات اللوجستية**: مزامنة فورية لجدول `logistics_queue` (محمي بـ user_id)
- **سجلات المركبات**: مزامنة فورية لجدول `tl_vehicle_logs`
- **سجلات العمليات**: مزامنة فورية لجدول `tl_ops_logs`
- **الموظفين**: مزامنة فورية لجدول `tl_workers`
- **الرسائل الداخلية**: مزامنة فورية لجدول `tl_messages`

### 👥 HR Module (إدارة الموارد البشرية)
- **الموظفين**: مزامنة فورية لجدول `hr_employees` (محمي بـ user_id)

### 🎉 Wedding Invitations (دعوات الأعراس)
- **الدعوات**: مزامنة فورية لجدول `wedding_invitations` (محمي بـ user_id)

## التقنية المستخدمة

### Supabase Realtime Subscriptions
تم استخدام Supabase Realtime للاشتراك في تغييرات الجداول (INSERT, UPDATE, DELETE) على جميع الجداول المذكورة أعلاه مع تصفية آمنة حسب المستخدم.

### Custom React Hook
تم إنشاء hook مخصص `useSupabaseRealtime` لإدارة الاشتراكات بشكل آمن مع تنظيف تلقائي عند إغلاق الصفحة.

### State Auto-Update
فور استلام أي حدث (Event) من Supabase Realtime، يتم تحديث الـ React State محلياً ليعرض البيانات الجديدة فوراً.

### Safety Check
تم التأكد من:
- تنظيف الـ Subscriptions عند إغلاق الصفحة (unsubscribe in useEffect cleanup)
- تصفية جميع الاشتراكات حسب `user_id` أو `store_id`
- عدم تسريب بيانات بين المستخدمين

## تفعيل Realtime في قاعدة البيانات

تم تطبيق Migration بالفعل على قاعدة البيانات. جميع الجداول التالية مفعّلة الآن:

### الجداول المفعّلة:
- 📦 Inventory & Production:
  - `inventory`
  - `production_requests`
  - `logistics_queue`
  - `inventory_products`
  - `hr_employees`
- 🚚 Delivery Hub:
  - `delivery_hub_stores`
  - `delivery_hub_products`
  - `delivery_hub_orders`
  - `delivery_hub_order_items`
  - `delivery_hub_order_messages`
- 🎉 Wedding Invitations:
  - `wedding_invitations`
- 📋 Legacy Delivery Schema:
  - `stores`
  - `products`
  - `orders`
  - `order_items`
  - `order_messages`

## التحقق من تفعيل Realtime

للتحقق من تفعيل Realtime:

1. افتح Supabase Dashboard
2. اذهب إلى **Database** > **Replication**
3. ستجد جميع الجداول المذكورة أعلاه مفعّلة في Realtime

## اختبار المزامنة الفورية

لاختبار المزامنة الفورية:

1. افتح التطبيق في جهازين مختلفين (أو نافذتي متصفح مختلفة) بنفس الحساب
2. في الجهاز الأول، أضف أو عدّل:
   - منتج في المخزون
   - طلب إنتاج
   - موظف في HR
   - طلب في Delivery Hub
3. لاحظ أن التغيير يظهر فوراً في الجهاز الثاني بدون تحديث الصفحة

## استكشاف الأخطاء

### إذا لم تعمل المزامنة الفورية:

1. **تأكد من تطبيق Migration**: تم تطبيق Migration بالفعل بنجاح ✅
2. **تحقق من إعدادات Supabase**: تأكد من أن `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY` معيّنة في `.env`
3. **تحقق من Console**: افتح Console في المتصفح وابحث عن رسائل `[Realtime]` للتأكد من نجاح الاشتراك
4. **تحقق من RLS Policies**: تأكد من أن سياسات Row Level Security تسمح بالوصول للجداول

### رسائل Console المتوقعة:

- `[Realtime] Successfully subscribed to [table_name]` - يعني نجاح الاشتراك
- `[Realtime] Cleaning up subscription to [table_name]` - يعني تنظيف آمن عند إغلاق الصفحة
- `[Realtime] Error subscribing to [table_name]` - يعني وجود خطأ في الاشتراك

## الملفات المعدّلة

### الملفات الجديدة:
- `src/hooks/useSupabaseRealtime.ts` - Hook مخصص لإدارة Realtime Subscriptions
- `supabase/migrations/20260802000000_enable_realtime_inventory.sql` - Migration لتفعيل Realtime لجميع الجداول
- `apply-realtime-migration.js` - سكريبت لتطبيق Migration

### الملفات المعدّلة:
- `src/pages/modules/DeliveryHubModule.tsx` - تفعيل Realtime للطلبات والمنتجات
- `src/pages/modules/InventoryPosModule.tsx` - تفعيل Realtime للمخزون والإنتاج
- `src/pages/modules/TransportLogisticsHub.tsx` - تفعيل Realtime للخدمات اللوجستية
- `src/pages/modules/TransportLogisticsAdmin.tsx` - تفعيل Realtime للنقل واللوجيستيك
- `src/pages/modules/HrModule.tsx` - تفعيل Realtime للموارد البشرية

## الدعم الفني

إذا واجهت أي مشاكل، راجع:
- Console في المتصفح لرسائل الخطأ
- Supabase Dashboard > Database > Replication للتحقق من تفعيل Realtime
- Supabase Dashboard > Database > Logs لسجلات قاعدة البيانات
