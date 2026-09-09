"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import type { LabSnapshot } from "@/app/actions/offline";
import type { CloudBackupStatus, CloudSyncResult } from "@/lib/sync/cloud";
import { readSnapshot, writeSnapshot } from "@/lib/offline/cache";
import { listOutbox } from "@/lib/offline/outbox";
import { flushOutbox } from "@/lib/offline/sync";
import { cn } from "@/lib/utils";

const LOGIN_SYNC_FLAG = "aliquot-sync-on-login";

export function markSyncAfterLogin() {
  try {
    sessionStorage.setItem(LOGIN_SYNC_FLAG, "1");
  } catch {
    /* Private mode can block sessionStorage; login still proceeds. */
  }
}

type DataSyncValue = {
  snapshot: LabSnapshot | null;
  ready: boolean;
  lastSyncedAt: string | null;
  queued: number;
  syncing: boolean;
  syncNow: (options?: { auto?: boolean }) => Promise<void>;
  loadCache: () => Promise<void>;
  patchSnapshot: (updater: (snapshot: LabSnapshot) => LabSnapshot) => Promise<void>;
};

const DataSyncContext = createContext<DataSyncValue | null>(null);

async function requestLabSnapshot(mode: "cache" | "sync"): Promise<LabSnapshot> {
  const response = await fetch("/api/lab/sync", {
    method: mode === "sync" ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(mode === "sync" ? 20_000 : 30_000),
  });
  const body = (await response.json().catch(() => null)) as LabSnapshot | { error?: string } | null;
  if (!response.ok) {
    throw new Error(body && "error" in body && body.error ? body.error : "Could not sync lab data.");
  }
  return body as LabSnapshot;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readCloudBackupStatus(): Promise<CloudBackupStatus> {
  const response = await fetch("/api/lab/sync/status", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  const body = (await response.json().catch(() => null)) as CloudBackupStatus | { error?: string } | null;
  if (!response.ok) {
    throw new Error(body && "error" in body && body.error ? body.error : "Could not check backup status.");
  }
  return body as CloudBackupStatus;
}

function statusToResult(status: CloudBackupStatus): CloudSyncResult {
  if (status.result) return status.result;
  if (status.lastError) {
    return { ok: false, skipped: false, pushed: 0, pulled: 0, conflicts: [], message: status.lastError };
  }
  if (status.lastPushedAt) {
    return { ok: true, skipped: false, pushed: 0, pulled: 0, conflicts: [], message: "Lab data backed up." };
  }
  return {
    ok: false,
    skipped: false,
    pending: true,
    pushed: 0,
    pulled: 0,
    conflicts: [],
    message: "Cloud backup did not finish.",
  };
}

async function waitForCloudBackup(): Promise<CloudSyncResult> {
  const started = Date.now() - 2_000;
  const deadline = Date.now() + 75_000;
  let delay = 800;
  while (Date.now() < deadline) {
    const status = await readCloudBackupStatus();
    if (!status.running && status.result) return status.result;
    const updated = status.updatedAt ? Date.parse(status.updatedAt) : 0;
    const pushed = status.lastPushedAt ? Date.parse(status.lastPushedAt) : 0;
    if (!status.running && (updated >= started || pushed >= started)) return statusToResult(status);
    await sleep(delay);
    delay = Math.min(Math.round(delay * 1.25), 3_000);
  }
  return {
    ok: false,
    skipped: false,
    pushed: 0,
    pulled: 0,
    conflicts: [],
    message: "Cloud backup timed out. Tap Sync again.",
  };
}

function toastAfterSync(cloud: CloudSyncResult | undefined, outbox: { flushed: number; remaining: number }) {
  if (cloud && !cloud.ok && !cloud.skipped) {
    toast.error(cloud.message);
  } else if (outbox.flushed > 0 && outbox.remaining > 0) {
    toast.success(`Updated lab data. ${outbox.flushed} queued change${outbox.flushed === 1 ? "" : "s"} sent.`);
  } else if (outbox.flushed > 0) {
    toast.success(
      outbox.flushed === 1
        ? "Sent 1 queued change and refreshed lab data."
        : `Sent ${outbox.flushed} queued changes and refreshed lab data.`
    );
  } else if (cloud && !cloud.skipped) {
    toast.success(cloud.message);
  } else {
    toast.success("Lab data updated.");
  }
  if (cloud?.conflicts.length) {
    toast.message(
      cloud.conflicts.length === 1
        ? cloud.conflicts[0].reason
        : `${cloud.conflicts.length} sync conflicts. Lab results were not overwritten.`
    );
  }
  if (outbox.remaining > 0) {
    toast.error(
      `${outbox.remaining} queued change${outbox.remaining === 1 ? "" : "s"} still waiting. Tap Sync again.`
    );
  }
}

export function DataSyncProvider({
  children,
  initialSnapshot = null,
}: {
  children: ReactNode;
  initialSnapshot?: LabSnapshot | null;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<LabSnapshot | null>(initialSnapshot);
  const [ready, setReady] = useState(Boolean(initialSnapshot));
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const snapshotRef = useRef<LabSnapshot | null>(initialSnapshot);
  const syncingRef = useRef(false);

  const applySnapshot = useCallback((next: LabSnapshot | null) => {
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);

  const persistSnapshot = useCallback(async (next: LabSnapshot) => {
    applySnapshot(next);
    try {
      await writeSnapshot(next);
    } catch {
      /* IndexedDB is optional; the in-memory snapshot still renders. */
    }
  }, [applySnapshot]);

  const loadCache = useCallback(async () => {
    const next = await requestLabSnapshot("cache");
    await persistSnapshot(next);
  }, [persistSnapshot]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        if (snapshotRef.current) {
          try {
            await writeSnapshot(snapshotRef.current);
          } catch {
            /* ignore */
          }
          return;
        }

        try {
          const existing = await readSnapshot();
          if (cancelled) return;
          if (existing) {
            applySnapshot(existing);
            return;
          }
        } catch {
          /* IndexedDB may be blocked; load from the lab server instead. */
        }

        let lastError: unknown;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const next = await requestLabSnapshot("cache");
            if (cancelled) return;
            await persistSnapshot(next);
            return;
          } catch (error) {
            lastError = error;
            await sleep(400 * (attempt + 1));
            if (cancelled) return;
          }
        }
        if (lastError) throw lastError;
      } catch {
        /* CacheMiss offers a retry. */
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void hydrate();

    function refreshQueue() {
      void listOutbox()
        .then((items) => setQueued(items.length))
        .catch(() => setQueued(0));
    }
    function onCache() {
      void readSnapshot().then((next) => {
        if (!cancelled && next) applySnapshot(next);
      });
    }
    refreshQueue();
    window.addEventListener("aliquot-outbox", refreshQueue);
    window.addEventListener("aliquot-cache", onCache);
    return () => {
      cancelled = true;
      window.removeEventListener("aliquot-outbox", refreshQueue);
      window.removeEventListener("aliquot-cache", onCache);
    };
  }, [applySnapshot, persistSnapshot]);

  const patchSnapshot = useCallback(async (updater: (current: LabSnapshot) => LabSnapshot) => {
    const current = snapshotRef.current ?? (await readSnapshot().catch(() => null));
    if (!current) return;
    const next = updater(current);
    await persistSnapshot(next);
  }, [persistSnapshot]);

  const syncNow = useCallback(async (options?: { auto?: boolean }) => {
    if (syncingRef.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      if (!options?.auto) toast.error("You’re offline. Connect, then tap Sync.");
      return;
    }

    syncingRef.current = true;
    setSyncing(true);
    if (options?.auto) toast.message("Internet connected — syncing lab data…");
    try {
      const pushed = await flushOutbox();
      const next = await requestLabSnapshot("sync");
      await persistSnapshot(next);
      router.refresh();
      let cloud = next.cloudSync;
      if (cloud?.pending) cloud = await waitForCloudBackup();
      toastAfterSync(cloud, pushed);
    } catch (error) {
      const timedOut =
        (error instanceof DOMException && error.name === "TimeoutError") ||
        (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"));
      toast.error(timedOut ? "Could not reach the lab server. Tap Sync again." : error instanceof Error ? error.message : "Could not sync. Try again.");
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [persistSnapshot, router]);

  const value = useMemo(
    () => ({
      snapshot,
      ready,
      lastSyncedAt: snapshot?.syncedAt ?? null,
      queued,
      syncing,
      syncNow,
      loadCache,
      patchSnapshot,
    }),
    [snapshot, ready, queued, syncing, syncNow, loadCache, patchSnapshot]
  );

  useEffect(() => {
    if (!ready) return;

    function tryLoginSync() {
      try {
        if (sessionStorage.getItem(LOGIN_SYNC_FLAG) !== "1") return;
      } catch {
        return;
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      try {
        sessionStorage.removeItem(LOGIN_SYNC_FLAG);
      } catch {
        /* ignore */
      }
      void syncNow({ auto: true });
    }

    tryLoginSync();
    window.addEventListener("online", tryLoginSync);
    return () => window.removeEventListener("online", tryLoginSync);
  }, [ready, syncNow]);

  return <DataSyncContext.Provider value={value}>{children}</DataSyncContext.Provider>;
}

export function useDataSync() {
  const ctx = useContext(DataSyncContext);
  if (!ctx) throw new Error("useDataSync must be used within DataSyncProvider");
  return ctx;
}

export function CacheMiss({ loading }: { loading: ReactNode }) {
  const { snapshot, ready, syncing, loadCache } = useDataSync();
  const [loadingCache, setLoadingCache] = useState(false);

  if (snapshot) return null;
  if (!ready || syncing || loadingCache) return <>{loading}</>;
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <EmptyState
        title="Lab data isn’t cached yet"
        description="Load patients, the worklist, and dashboard counts from this lab computer. Pages then stay cached until you sync again."
        action={
          <Button
            type="button"
            onClick={() => {
              setLoadingCache(true);
              void loadCache()
                .catch((error) => {
                  toast.error(error instanceof Error ? error.message : "Could not load lab data.");
                })
                .finally(() => setLoadingCache(false));
            }}
          >
            <RefreshCw />
            Load lab data
          </Button>
        }
      />
    </div>
  );
}

function formatSynced(iso: string | null) {
  if (!iso) return "Not cached yet";
  const date = new Date(iso);
  return `Cached ${date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
}

export function SyncControl({ compact = false }: { compact?: boolean }) {
  const { lastSyncedAt, queued, syncing, syncNow } = useDataSync();

  if (compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => void syncNow()}
        disabled={syncing}
        aria-label={queued > 0 ? `Sync, ${queued} waiting` : "Sync lab data"}
      >
        <RefreshCw className={cn(syncing && "animate-spin")} />
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-start"
        onClick={() => void syncNow()}
        disabled={syncing}
      >
        <RefreshCw className={cn(syncing && "animate-spin")} />
        {syncing ? "Syncing…" : queued > 0 ? `Sync (${queued})` : "Sync"}
      </Button>
      <p className="px-1 text-[11px] text-sidebar-muted">{formatSynced(lastSyncedAt)}</p>
    </div>
  );
}
