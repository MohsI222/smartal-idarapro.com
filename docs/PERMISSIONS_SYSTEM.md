# نظام إدارة الصلاحيات (Permissions Management System)

## نظرة عامة

تم تطبيق نظام شامل لإدارة الصلاحيات للتحكم في قفل وفتح الأقسام والصفحات للموظفين والمستخدمين من طرف مدير النظام (Admin).

## الميزات الرئيسية

### 🔒 عزل البيانات الأمني
- كل مستخدم يرى فقط الأقسام المصرح له بالوصول إليها
- الصلاحيات مُصفّاة حسب `user_id` لضمان عدم تسريب البيانات
- RLS Policies (Row Level Security) تضمن الأمان على مستوى قاعدة البيانات

### 🎛️ لوحة تحكم المشرف (Admin UI)
- واجهة سهلة الاستخدام في HR Module لإدارة صلاحيات الموظفين
- مفاتيح تفعيل/تعطيل (Toggle switches) لكل قسم
- إمكانية تعيين مستخدمين كـ Admins لإدارة صلاحيات الآخرين

### 🛡️ حماية المسارات (Route Protection)
- الشريط الجانبي (Sidebar Navigation) يخفي الأقسام المغلقة تلقائياً
- حماية الـ Routes لمنع الوصول المباشر عبر الرابط
- صفحة "Access Denied" مخصصة للمستخدمين غير المصرح لهم

## البنية التقنية

### جدول Permissions في قاعدة البيانات

```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_access_inventory BOOLEAN DEFAULT false,
  can_access_hr BOOLEAN DEFAULT false,
  can_access_delivery BOOLEAN DEFAULT false,
  can_access_transport_logistics BOOLEAN DEFAULT false,
  can_access_wedding_invitations BOOLEAN DEFAULT false,
  can_access_legal BOOLEAN DEFAULT false,
  can_access_ai BOOLEAN DEFAULT false,
  can_access_settings BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);
```

### الصلاحيات المتاحة

| الصلاحية | القسم | الوصف |
|---------|-------|-------|
| `can_access_inventory` | Inventory/POS | الوصول لإدارة المخزون ونقاط البيع |
| `can_access_hr` | HR Module | الوصول لإدارة الموارد البشرية |
| `can_access_delivery` | Delivery Hub | الوصول لرادار الطلبات والتوصيل |
| `can_access_transport_logistics` | Transport Logistics | الوصول للنقل واللوجيستيك |
| `can_access_wedding_invitations` | Wedding Invitations | الوصول لدعوات الأعراس |
| `can_access_legal` | Legal Module | الوصول للقانون والمحامين |
| `can_access_ai` | AI Features | الوصول للميزات الذكية |
| `can_access_settings` | Settings | الوصول للإعدادات |
| `is_admin` | Admin Access | صلاحيات المشرف لإدارة صلاحيات الآخرين |

## المكونات البرمجية

### 1. PermissionsContext
الموقع: `src/context/PermissionsContext.tsx`

يوفر Context و Hooks لإدارة الصلاحيات في التطبيق:

```typescript
const { hasPermission, isAdmin, refreshPermissions } = usePermissions();

// التحقق من صلاحية معينة
if (hasPermission('can_access_inventory')) {
  // المستخدم لديه صلاحية الوصول
}

// التحقق من أن المستخدم مشرف
if (isAdmin()) {
  // المستخدم مشرف يمكنه إدارة صلاحيات الآخرين
}
```

### 2. PermissionsManager Component
الموقع: `src/components/hr/PermissionsManager.tsx`

واجهة المستخدم لإدارة صلاحيات موظف معين:

```typescript
<PermissionsManager
  userId={employee.id}
  userName={employee.name}
  isAdmin={currentUserIsAdmin}
  onSave={() => console.log('Permissions saved')}
/>
```

### 3. ProtectedRoute Component
الموقع: `src/components/ProtectedRoute.tsx`

حماية المسارات بناءً على الصلاحيات:

```typescript
<ProtectedRoute permission="can_access_inventory">
  <InventoryModule />
</ProtectedRoute>
```

### 4. AccessDeniedScreen
الموقع: `src/components/AccessDeniedScreen.tsx`

صفحة مخصصة للمستخدمين غير المصرح لهم بالوصول.

## التكامل مع التطبيق

### تحديث Sidebar Navigation
تم تحديث `src/components/layout/AppShell.tsx` لتصفية عناصر التنقل بناءً على الصلاحيات:

```typescript
const navItems = useMemo(() => {
  return PLATFORM_NAV.filter((n) => {
    if (!navItemVisibleForModules(n.to, modSet)) return false;
    if (n.permission && !hasPermission(n.permission)) return false;
    return true;
  });
}, [t, modSet, hasPermission]);
```

### تحديث HR Module
تم إضافة تبويب "الصلاحيات" في HR Module يظهر فقط للمشرفين:

```typescript
{isAdmin && (
  <TabsTrigger value="permissions">
    <Shield className="size-4" />
    الصلاحيات
  </TabsTrigger>
)}
```

### إضافة PermissionsProvider
تم إضافة `PermissionsProvider` في `App.tsx` لتوفير الصلاحيات لجميع المكونات:

```typescript
<PermissionsProvider userId={user?.id}>
  {children}
</PermissionsProvider>
```

## كيفية الاستخدام

### للمشرفين (Admins)

1. **الوصول إلى لوحة الصلاحيات**
   - افتح HR Module
   - انتقل إلى تبويب "الصلاحيات" (يظهر فقط للمشرفين)

2. **تعديل صلاحيات موظف**
   - ابحث عن الموظف في القائمة
   - استخدم المفاتيح (Toggle switches) لتفعيل/تعطيل الأقسام
   - اضغط "Save Permissions" لحفظ التغييرات

3. **تعيين مشرف جديد**
   - فعّل خيار "Admin Access" للموظف
   - سيتمكن من إدارة صلاحيات الموظفين الآخرين

### للمطورين

### إضافة صلاحية جديدة

1. **تحديث جدول permissions**
   ```sql
   ALTER TABLE permissions ADD COLUMN can_access_new_section BOOLEAN DEFAULT false;
   ```

2. **تحديث UserPermissions interface**
   ```typescript
   export interface UserPermissions {
     // ... existing fields
     can_access_new_section: boolean;
   }
   ```

3. **تحديث appNav.ts**
   ```typescript
   {
     to: "/app/new-section",
     icon: NewIcon,
     labelKey: "nav.newSection",
     permission: "can_access_new_section",
   }
   ```

4. **تحديث PermissionsManager**
   ```typescript
   { key: 'can_access_new_section' as const, label: 'New Section', icon: '🆕' }
   ```

### حماية مكون جديد

```typescript
import { ProtectedRoute } from "@/components/ProtectedRoute";

function NewSection() {
  return (
    <ProtectedRoute permission="can_access_new_section">
      <NewSectionContent />
    </ProtectedRoute>
  );
}
```

## الأمان

### Row Level Security (RLS)

تم تفعيل RLS على جدول permissions:

- **المستخدمون يمكنهم قراءة صلاحياتهم الخاصة فقط**
- **المشرفون يمكنهم قراءة/تعديل جميع الصلاحيات**
- **المشرفون فقط يمكنهم إضافة/حذف صلاحيات**

### التصفية في Supabase Realtime

جميع Realtime Subscriptions مُصفّاة حسب `user_id` لضمان عزل البيانات:

```typescript
useInventoryRealtime(
  user?.id || "",  // تصفية حسب user_id
  onInsert,
  onUpdate,
  onDelete,
  isSupabaseConfigured
);
```

## الاختبار

### اختبار الصلاحيات

1. **إنشاء مستخدمين تجريبيين**
   ```sql
   INSERT INTO permissions (user_id, can_access_inventory, is_admin)
   VALUES ('user-id-1', true, false);
   ```

2. **اختبار الوصول**
   - سجل الدخول كمستخدم عادي
   - تحقق من أن الأقسام المغلقة لا تظهر
   - حاول الوصول عبر الرابط المباشر
   - تأكد من ظهور صفحة Access Denied

3. **اختبار المشرف**
   - سجل الدخول كمشرف
   - تحقق من ظهور تبويب الصلاحيات
   - عدّل صلاحيات مستخدم آخر
   - تحقق من تطبيق التغييرات فوراً

## استكشاف الأخطاء

### المشاكل الشائعة

1. **الأقسام لا تظهر في Sidebar**
   - تحقق من أن الصلاحيات مفعّلة في قاعدة البيانات
   - تحقق من أن `PermissionsProvider` مضاف في App.tsx
   - تحقق من أن `hasPermission` يعمل بشكل صحيح

2. **صفحة Access Denied تظهر دائماً**
   - تحقق من أن المستخدم لديه الصلاحية المطلوبة
   - تحقق من أن `user_id` صحيح في جدول permissions
   - تحقق من أن RLS policies مفعّلة بشكل صحيح

3. **المشرف لا يمكن رؤية تبويب الصلاحيات**
   - تحقق من أن `is_admin = true` في جدول permissions
   - تحقق من أن `isAdmin()` hook يعمل بشكل صحيح

## الصيانة

### تحديث الصلاحيات الافتراضية

عند إنشاء مستخدم جديد، يتم إنشاء صلاحيات افتراضية مع جميع الأقسام مفعّلة. لتغيير هذا السلوك، عدّل `PermissionsContext.tsx`:

```typescript
const { data: newPermissions } = await supabase
  .from('permissions')
  .insert({
    user_id: userId,
    can_access_inventory: false,  // غير إلى false
    can_access_hr: false,         // غير إلى false
    // ... etc
    is_admin: false,
  })
```

## المستقبل

### التحسينات المقترحة

1. **صلاحيات أكثر تفصيلاً**
   - صلاحيات للقراءة فقط (Read-only)
   - صلاحيات للإنشاء/التعديل/الحذف منفصلة

2. **مجموعات الصلاحيات (Roles)**
   - إنشاء مجموعات صلاحيات جاهزة
   - تعيين مجموعات للمستخدمين بدلاً من صلاحيات فردية

3. **سجل التغييرات (Audit Log)**
   - تسجيل من قام بتغيير الصلاحيات ومتى
   - مراقبة التغييرات المشبوهة

4. **صلاحيات مؤقتة**
   - صلاحيات تنتهي بعد فترة زمنية محددة
   - صلاحيات مؤقتة للمشاريع الخاصة
