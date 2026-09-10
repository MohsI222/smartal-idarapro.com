/** يطابق البريد الافتراضي للمشرف في الخادم — للجلسة الطويلة في الواجهة */
export const PUBLIC_SUPER_ADMIN_EMAIL = (
  (import.meta.env.VITE_SUPER_ADMIN_EMAIL as string | undefined) ?? "lahcenm534@gmail.com"
)
  .trim()
  .toLowerCase();
