import { TL_DEPT_SLUGS } from "@/lib/tlApi";

/** مسارات PWA لجميع أقسام TL (نقل، لوجستيك، إنتاج، جودة، إلخ) — واجهة موظف دون الشريط الكامل للوحة المدير */
export const TL_PWA_DEPT_PREFIXES = TL_DEPT_SLUGS.map((slug) => `/dept/${slug}`);

/** واجهة أقسام TL — بدون شريط لوحة التحكم الكاملة */
export function isDeptTransportShellHiddenPath(pathname: string): boolean {
  const pathOnly = pathname.split("?")[0].trim();
  const p = pathOnly.replace(/\/$/, "") || "/";
  return isTlTransportLogisticsDeptPath(p);
}

export function isTlTransportLogisticsDeptPath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  return TL_PWA_DEPT_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

export function isTlPwaFocusDeptSlug(dept: string | null | undefined): boolean {
  return Boolean(dept && (TL_DEPT_SLUGS as readonly string[]).includes(dept));
}
