/** مسارات PWA لأقسام النقل واللوجستيك — بدون كروم لوحة المدير إن وُضعت تحت نفس الـ layout */
export const TL_PWA_DEPT_PREFIXES = ["/dept/transport", "/dept/logistics"] as const;

export function isDeptTransportShellHiddenPath(pathname: string): boolean {
  const pathOnly = pathname.split("?")[0].trim();
  const p = pathOnly.replace(/\/$/, "") || "/";
  return p === "/dept/transport" || p.startsWith("/dept/transport/");
}

export function isTlTransportLogisticsDeptPath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  return TL_PWA_DEPT_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

export function isTlPwaFocusDeptSlug(dept: string | null | undefined): boolean {
  return dept === "transport" || dept === "logistics";
}
