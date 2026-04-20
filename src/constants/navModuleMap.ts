import type { SectionId } from "./sections";

/**
 * ربط مسار الشريط الجانبي بالوحدة المطلوبة (أي وحدة من القائمة تكفي لإظهار الرابط)
 */
export function pathRequiresModules(path: string): SectionId[] {
  const base = path.split("?")[0] ?? path;
  const map: Record<string, SectionId[]> = {
    "/app/inventory": ["inventory"],
    "/app/visa": ["visa"],
    "/app/company": ["company"],
    "/app/gov": ["gov"],
    "/app/edu-print": ["edu_print"],
    "/app/techauto": ["inventory", "tools"],
    "/app/chat": ["chat"],
    "/app/academy": ["academy"],
    "/app/tools": ["tools"],
    "/app/members": ["members"],
    "/app/media-lab": ["media_lab"],
    "/app/tl": ["transport_logistics"],
    "/app/edu": ["edu"],
    "/app/public": ["public"],
    "/app/acc": ["acc"],
    "/app/law": ["law"],
    "/app/legal-ai": ["legal_ai"],
    "/app/hr": ["hr"],
    "/app/reminders": ["reminders"],
  };
  return map[base] ?? [];
}

export function navItemVisibleForModules(path: string, approved: SectionId[]): boolean {
  const req = pathRequiresModules(path);
  if (req.length === 0) return true;
  return req.some((m) => approved.includes(m));
}
