/**
 * هوية التطبيق المركزية — للواجهة وتصدير Excel / Word.
 * لا يُقرأ من الخادم؛ يمكن مستقبلاً دمج prefs المستخدم مع هذه القيم كبدء.
 */

export const APP_BRANDING = {
  /** الاسم المعروض في الوثائق والترويسات */
  businessName: "Smart Al-Idara Pro",
  /** اسم قصير للجداول والملخصات */
  shortName: "Al-Idara",
  /** مسار الشعار الثابت في `public/` */
  logoUrl: "/logo.svg",
  /** ألوان الهوية (Tailwind متوافقة مع الواجهة الحالية) */
  primaryHex: "#0052CC",
  secondaryHex: "#FF8C00",
  accentHex: "#003876",
  /** نص تحت الترويسة في التصديرات */
  taglineAr: "منصة الإدارة الذكية",
  taglineEn: "Smart management platform",
} as const;

/** تحويل #RRGGBB إلى ARGB لـ ExcelJS (قيمة Excel) */
export function hexToExcelArgb(hex: string): string {
  const h = hex.replace(/^#/, "").trim();
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) return "FF0052CC";
  return `FF${h.toUpperCase()}`;
}

/** لدمج الألوان مع Tailwind arbitrary values */
export function brandingCssVars(): Record<string, string> {
  return {
    "--brand-primary": APP_BRANDING.primaryHex,
    "--brand-secondary": APP_BRANDING.secondaryHex,
    "--brand-accent": APP_BRANDING.accentHex,
  };
}
