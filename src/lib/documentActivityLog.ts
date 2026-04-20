/** Local activity log for generated documents (dashboard stats UX). */

export type DocumentActivityEntry = {
  id: string;
  at: string;
  kind: string;
  title: string;
};

const STORAGE_KEY = "idara_doc_activity_v1";

export function pushDocumentActivity(kind: string, title: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: DocumentActivityEntry[] = raw ? (JSON.parse(raw) as DocumentActivityEntry[]) : [];
    list.unshift({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      kind,
      title: title.slice(0, 200),
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 80)));
    window.dispatchEvent(new CustomEvent("idara-doc-activity"));
  } catch {
    /* storage full or private mode */
  }
}

export function readDocumentActivity(): DocumentActivityEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as DocumentActivityEntry[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function clearDocumentActivity(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("idara-doc-activity"));
  } catch {
    /* ignore */
  }
}
