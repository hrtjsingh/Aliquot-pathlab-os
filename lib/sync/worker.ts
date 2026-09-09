const INTERVAL_MS = 5 * 60 * 1000;
const FIRST_DELAY_MS = 30_000;

declare global {
  var __aliquotCloudSyncStarted: boolean | undefined;
  var __aliquotCloudSyncBusy: boolean | undefined;
}

export function startCloudSyncWorker() {
  if (globalThis.__aliquotCloudSyncStarted) return;
  if (!process.env.CLOUD_DATABASE_URL) return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  globalThis.__aliquotCloudSyncStarted = true;

  const tick = async () => {
    if (globalThis.__aliquotCloudSyncBusy) return;
    globalThis.__aliquotCloudSyncBusy = true;
    try {
      const { syncAllVendorsToCloud } = await import("@/lib/sync/cloud");
      await syncAllVendorsToCloud();
    } catch {
      /* Backup must never take down the lab server. */
    } finally {
      globalThis.__aliquotCloudSyncBusy = false;
    }
  };

  setTimeout(() => void tick(), FIRST_DELAY_MS);
  setInterval(() => void tick(), INTERVAL_MS);
}
