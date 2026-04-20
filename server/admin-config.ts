/**
 * المشرف العام — يمكن تجاوزها بمتغيرات البيئة في `.env`.
 */
export const SUPER_ADMIN_EMAIL = (
  process.env.SUPER_ADMIN_EMAIL ?? "lahcenm534@gmail.com"
)
  .trim()
  .toLowerCase();

/** واتساب (صيغة دولية، بدون مسافات داخل التخزين) */
export const SUPER_ADMIN_WHATSAPP = (
  process.env.SUPER_ADMIN_WHATSAPP ?? "+2127802970"
).trim();

export const SUPER_ADMIN_DISPLAY_NAME =
  process.env.SUPER_ADMIN_NAME ?? "LAHCEN EL MOUTAOUAKIL";

/**
 * كلمة مرور تسجيل الدخول للمشرف — يُفضّل وضعها في `.env` (SUPER_ADMIN_PASSWORD).
 */
export function getSuperAdminPassword(): string {
  return process.env.SUPER_ADMIN_PASSWORD ?? "Lahcen2026@";
}

/** جلسة طويلة الأمد وتجاوز حد الأجهزة — المشرف المحدد */
const PRIMARY_ADMIN_NAME = "LAHCEN EL MOUTAOUAKIL";

export function isPrimaryAdminUser(email: string, name: string): boolean {
  const e = email.trim().toLowerCase();
  if (e === SUPER_ADMIN_EMAIL) return true;
  const n = name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  return n === PRIMARY_ADMIN_NAME || (n.includes("LAHCEN") && n.includes("MOUTAOUAKIL"));
}

/** مدة رمز الدخول للمشرف الأساسي (افتراضياً 10 سنوات) */
export const PRIMARY_ADMIN_SESSION_MS =
  (Number(process.env.PRIMARY_ADMIN_JWT_YEARS) || 10) * 365 * 864e5;

/** كل الأقسام — اشتراك معتمد فوراً (SaaS). رادار التأشيرة يُدار بموافقة منفصلة (visa_unlock_approved). */
export const FULL_MODULES_JSON = JSON.stringify([
  "hr",
  "law",
  "acc",
  "public",
  "edu",
  "inventory",
  "members",
  "company",
  "academy",
  "gov",
  "legal_ai",
  "media_lab",
]);

/** مدة الاشتراك بعد الموافقة (بالأيام) */
export const SUBSCRIPTION_PERIOD_DAYS = Number(process.env.SUBSCRIPTION_PERIOD_DAYS) || 30;
