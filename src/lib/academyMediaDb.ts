/**
 * تخزين وسائط الأكاديمية (صور/فيديو محلي) في IndexedDB — يبقى بعد إعادة التحميل حتى الحذف الصريح.
 */

const DB_NAME = "smart_al_idara_academy";
const DB_VER = 3;
const STORE_MEDIA = "local_media";
const STORE_YOUTUBE = "youtube_links";

export type AcademyStoredMediaRow = {
  id: string;
  userId: string;
  name: string;
  mime: string;
  blob: Blob;
  title?: string;
  description?: string;
  thumbnailBlob?: Blob;
};

export type AcademyStoredYoutubeRow = {
  userId: string;
  linksText: string;
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
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          db.createObjectStore(STORE_MEDIA, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_YOUTUBE)) {
          db.createObjectStore(STORE_YOUTUBE, { keyPath: "userId" });
        }
      };
    });
  }
  return dbOpen;
}

export async function academyMediaListForUser(userId: string): Promise<AcademyStoredMediaRow[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, "readonly");
    const q = tx.objectStore(STORE_MEDIA).getAll();
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
    const tx = db.transaction(STORE_MEDIA, "readwrite");
    const req = tx.objectStore(STORE_MEDIA).put(row);
    req.onerror = () => reject(req.error ?? new Error("indexedDB_put_failed"));
    tx.oncomplete = () => resolve();
  });
}

export async function academyMediaDelete(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, "readwrite");
    const req = tx.objectStore(STORE_MEDIA).delete(id);
    req.onerror = () => reject(req.error ?? new Error("indexedDB_delete_failed"));
    tx.oncomplete = () => resolve();
  });
}

export async function academyMediaClearUser(userId: string): Promise<void> {
  const rows = await academyMediaListForUser(userId);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, "readwrite");
    const st = tx.objectStore(STORE_MEDIA);
    for (const r of rows) st.delete(r.id);
    tx.onerror = () => reject(tx.error ?? new Error("indexedDB_clear_failed"));
    tx.oncomplete = () => resolve();
  });
}

export async function academyYoutubeLinksGet(userId: string): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_YOUTUBE, "readonly");
    const req = tx.objectStore(STORE_YOUTUBE).get(userId);
    req.onerror = () => reject(req.error ?? new Error("indexedDB_read_failed"));
    req.onsuccess = () => {
      const row = req.result as AcademyStoredYoutubeRow | undefined;
      resolve(row?.linksText ?? null);
    };
  });
}

export async function academyYoutubeLinksSave(userId: string, linksText: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_YOUTUBE, "readwrite");
    const req = tx.objectStore(STORE_YOUTUBE).put({ userId, linksText });
    req.onerror = () => reject(req.error ?? new Error("indexedDB_put_failed"));
    tx.oncomplete = () => resolve();
  });
}

export async function academyYoutubeLinksClear(userId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_YOUTUBE, "readwrite");
    const req = tx.objectStore(STORE_YOUTUBE).delete(userId);
    req.onerror = () => reject(req.error ?? new Error("indexedDB_delete_failed"));
    tx.oncomplete = () => resolve();
  });
}
