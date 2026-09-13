import { openDb, STORE, txDone } from "@/lib/offline/db";

export type OutboxOp =
  | { type: "createPatient"; entries: [string, string][]; localId: string }
  | {
      type: "createOrder";
      params: {
        patientId: string;
        referringDoctor?: string;
        priority: "ROUTINE" | "URGENT" | "STAT";
        testIds: string[];
        panelIds: string[];
        discount?: number;
        amountPaid?: number;
      };
    }
  | {
      type: "saveManualResult";
      params: {
        orderId: string;
        testId: string;
        numericValue?: number | null;
        textValue?: string | null;
        referenceRangeText?: string | null;
      };
    }
  | { type: "transitionOrderStatus"; orderId: string; to: string }
  | { type: "markSampleCollectedAndReceived"; orderId: string }
  | { type: "technologistVerify"; orderId: string }
  | { type: "pathologistAuthorize"; orderId: string }
  | { type: "releaseReport"; orderId: string }
  | { type: "sendReportOnWhatsApp"; orderId: string }
  | { type: "markReportCollected"; orderId: string }
  | {
      type: "recordCriticalValueCall";
      params: {
        orderId: string;
        notifiedName: string;
        notifiedRole?: string;
        contactMethod: string;
        confirmationNote?: string;
      };
    };

export type OutboxItem = {
  id: string;
  createdAt: number;
  op: OutboxOp;
};

import { isInstalledPwa } from "@/lib/client-pwa";

export function isBrowserOffline() {
  // Offline queue is PWA/desktop only — live web stays online-only.
  if (!isInstalledPwa()) return false;
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function isNetworkError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.name === "TypeError" || /failed to fetch|network|offline/i.test(error.message);
}

export async function enqueueOp(op: OutboxOp) {
  const item: OutboxItem = { id: crypto.randomUUID(), createdAt: Date.now(), op };
  const db = await openDb();
  const tx = db.transaction(STORE.outbox, "readwrite");
  tx.objectStore(STORE.outbox).put(item);
  await txDone(tx);
  db.close();
  window.dispatchEvent(new Event("aliquot-outbox"));
  await requestBackgroundSync();
  return item.id;
}

export async function listOutbox() {
  const db = await openDb();
  const tx = db.transaction(STORE.outbox, "readonly");
  const req = tx.objectStore(STORE.outbox).getAll();
  const items = await new Promise<OutboxItem[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as OutboxItem[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeOutbox(id: string) {
  const db = await openDb();
  const tx = db.transaction(STORE.outbox, "readwrite");
  tx.objectStore(STORE.outbox).delete(id);
  await txDone(tx);
  db.close();
  window.dispatchEvent(new Event("aliquot-outbox"));
}

export async function rememberId(localId: string, remoteId: string) {
  const db = await openDb();
  const tx = db.transaction(STORE.ids, "readwrite");
  tx.objectStore(STORE.ids).put(remoteId, localId);
  await txDone(tx);
  db.close();
}

export async function resolveId(id: string) {
  if (!id.startsWith("offline-")) return id;
  const db = await openDb();
  const tx = db.transaction(STORE.ids, "readonly");
  const req = tx.objectStore(STORE.ids).get(id);
  const remote = await new Promise<string | undefined>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as string | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return remote ?? id;
}

async function requestBackgroundSync() {
  if (!("serviceWorker" in navigator) || !("SyncManager" in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register(
      "aliquot-outbox"
    );
  } catch {
    /* Background Sync is optional; online/offline events still flush the queue. */
  }
}

export function formEntries(formData: FormData): [string, string][] {
  return Array.from(formData.entries()).map(([key, value]) => [key, String(value)]);
}
