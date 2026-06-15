/**
 * تخزين وسائط الأكاديمية (صور/فيديو محلي) في IndexedDB — يبقى بعد إعادة التحميل حتى الحذف الصريح.
 */

const DB_NAME = "smart_al_idara_academy";
const DB_VER = 1;
const STORE = "local_media";

export type AcademyStoredMediaRow = {
  id: string;
  userId: string;
  name: string;
  mime: string;
  blob: Blob;
};

let dbOpen: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbOpen) {
    dbOpen = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onerror = () => {
        dbOpen = null;
        reject(req.error ?? new Error("indexedDB_open_failed"));
      };
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
    });
  }
  return dbOpen;
}

export async function academyMediaListForUser(userId: string): Promise<AcademyStoredMediaRow[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const q = tx.objectStore(STORE).getAll();
    q.onerror = () => reject(q.error ?? new Error("indexedDB_read_failed"));
    q.onsuccess = () => {
      const all = (q.result as AcademyStoredMediaRow[]).filter((r) => r.userId === userId);
      resolve(all);
    };
  });
}

export async function academyMediaAdd(row: AcademyStoredMediaRow): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(row);
    req.onerror = () => reject(req.error ?? new Error("indexedDB_put_failed"));
    tx.oncomplete = () => resolve();
  });
}

export async function academyMediaDelete(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(id);
    req.onerror = () => reject(req.error ?? new Error("indexedDB_delete_failed"));
    tx.oncomplete = () => resolve();
  });
}

export async function academyMediaClearUser(userId: string): Promise<void> {
  const rows = await academyMediaListForUser(userId);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const st = tx.objectStore(STORE);
    for (const r of rows) st.delete(r.id);
    tx.onerror = () => reject(tx.error ?? new Error("indexedDB_clear_failed"));
    tx.oncomplete = () => resolve();
  });
}
