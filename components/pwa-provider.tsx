"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useOffline } from "next/offline";
import { WifiOff } from "lucide-react";
import { listOutbox } from "@/lib/offline/outbox";
import { useIsInstalledPwa } from "@/lib/client-pwa";

export function PwaProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <PwaRuntime />
      {children}
    </>
  );
}

function PwaRuntime() {
  const isPwa = useIsInstalledPwa();
  const frameworkOffline = useOffline();
  const [browserOffline, setBrowserOffline] = useState(false);
  const isOffline = frameworkOffline || browserOffline;
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    function update() {
      setBrowserOffline(navigator.onLine === false);
    }
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) void registration.unregister();
      });
      return;
    }
    // Register SW in the browser so the app can be installed; offline UX only runs when launched as PWA.
    void navigator.serviceWorker.register("/sw.js");
  }, []);

  useEffect(() => {
    if (!isPwa) {
      setQueued(0);
      return;
    }
    function refreshCount() {
      void listOutbox()
        .then((items) => setQueued(items.length))
        .catch(() => setQueued(0));
    }
    refreshCount();
    window.addEventListener("aliquot-outbox", refreshCount);
    return () => window.removeEventListener("aliquot-outbox", refreshCount);
  }, [isPwa]);

  if (!isPwa) return null;
  if (!isOffline && queued === 0) return null;

  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center p-3">
      <div className="pointer-events-auto flex max-w-lg items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm shadow-lg">
        <WifiOff className="mt-0.5 size-4 shrink-0 text-accent" />
        <div className="min-w-0">
          <p className="font-medium text-foreground">{isOffline ? "You’re offline" : "Waiting to sync"}</p>
          <p className="text-xs text-muted-foreground">
            {isOffline
              ? queued > 0
                ? `${queued} change${queued === 1 ? "" : "s"} waiting. Tap Sync in the menu when you’re back online.`
                : "Pages you already opened stay available. New saves wait in the queue until you tap Sync."
              : `${queued} change${queued === 1 ? "" : "s"} waiting. Tap Sync in the menu to send them and refresh lab data.`}
          </p>
        </div>
      </div>
    </div>
  );
}
