import { openDb, STORE, txDone } from "@/lib/offline/db";
import type { LabSnapshot } from "@/app/actions/offline";

const SNAPSHOT_KEY = "snapshot";

export async function readSnapshot(): Promise<LabSnapshot | null> {
  const db = await openDb();
  const tx = db.transaction(STORE.meta, "readonly");
  const req = tx.objectStore(STORE.meta).get(SNAPSHOT_KEY);
  const value = await new Promise<LabSnapshot | undefined>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as LabSnapshot | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return value ?? null;
}

export async function writeSnapshot(snapshot: LabSnapshot) {
  const db = await openDb();
  const tx = db.transaction(STORE.meta, "readwrite");
  tx.objectStore(STORE.meta).put(snapshot, SNAPSHOT_KEY);
  await txDone(tx);
  db.close();
  window.dispatchEvent(new Event("aliquot-cache"));
}
