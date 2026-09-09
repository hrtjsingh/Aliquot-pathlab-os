"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const NavPendingContext = createContext<{ start: () => void; stop: () => void } | null>(null);

export function useNavPending() {
  return useContext(NavPendingContext);
}

export function NavPendingProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(0);
  const start = useCallback(() => setPending((n) => n + 1), []);
  const stop = useCallback(() => setPending((n) => Math.max(0, n - 1)), []);
  const value = useMemo(() => ({ start, stop }), [start, stop]);

  return (
    <NavPendingContext.Provider value={value}>
      {pending > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-accent/20">
          <div className="h-full w-1/3 bg-accent motion-safe:animate-route-bar" />
        </div>
      ) : null}
      {children}
    </NavPendingContext.Provider>
  );
}

export function useReportLinkPending(pending: boolean) {
  const ctx = useNavPending();
  const wasPending = useRef(false);

  useEffect(() => {
    if (!ctx) return;
    if (pending && !wasPending.current) {
      ctx.start();
      wasPending.current = true;
    }
    if (!pending && wasPending.current) {
      ctx.stop();
      wasPending.current = false;
    }
    return () => {
      if (wasPending.current) {
        ctx.stop();
        wasPending.current = false;
      }
    };
  }, [pending, ctx]);
}
