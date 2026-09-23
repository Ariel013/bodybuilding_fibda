export type Draft = {
  key: string;
  ranking: (string | null)[];
  selected: string[];
  saved_at: string;
};
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("fibda-ballot-drafts", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("drafts", { keyPath: "key" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function draftGet(key: string): Promise<Draft | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction("drafts", "readonly");
    const r = t.objectStore("drafts").get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    t.oncomplete = () => db.close();
  });
}
export async function draftSave(draft: Draft) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const t = db.transaction("drafts", "readwrite");
    t.objectStore("drafts").put(draft);
    t.oncomplete = () => {
      db.close();
      resolve();
    };
    t.onerror = () => reject(t.error);
  });
}
export async function draftDelete(key: string) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const t = db.transaction("drafts", "readwrite");
    t.objectStore("drafts").delete(key);
    t.oncomplete = () => {
      db.close();
      resolve();
    };
    t.onerror = () => reject(t.error);
  });
}
