const DB_NAME = "aliquot-offline";
const DB_VERSION = 2;

export const STORE = {
  outbox: "outbox",
  ids: "ids",
  meta: "meta",
} as const;

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE.outbox)) db.createObjectStore(STORE.outbox, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORE.ids)) db.createObjectStore(STORE.ids);
      if (!db.objectStoreNames.contains(STORE.meta)) db.createObjectStore(STORE.meta);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
