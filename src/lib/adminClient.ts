import { PUBLIC_SUPER_ADMIN_EMAIL } from "@/constants/publicSuperAdmin";

/** يطابق منطق الخادم للمشرف الأساسي (لحسن) — تفعيل كامل دون قيود اشتراك */
export function isPrimaryAdminClient(email?: string | null, name?: string | null): boolean {
  const e = email?.trim().toLowerCase() ?? "";
  if (e === PUBLIC_SUPER_ADMIN_EMAIL) return true;
  const n = name?.trim().toUpperCase().replace(/\s+/g, " ") ?? "";
  return n === "LAHCEN EL MOUTAOUAKIL" || (n.includes("LAHCEN") && n.includes("MOUTAOUAKIL"));
}
