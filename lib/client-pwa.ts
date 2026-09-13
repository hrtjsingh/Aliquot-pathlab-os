"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    aliquotDesktop?: unknown;
  }
}

/** True when launched as installed PWA or Electron desktop — not a normal browser tab. */
export function isInstalledPwa() {
  if (typeof window === "undefined") return false;
  if (window.aliquotDesktop) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return true;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.matchMedia("(display-mode: window-controls-overlay)").matches) return true;
  return false;
}

export function useIsInstalledPwa() {
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function refresh() {
      setInstalled(isInstalledPwa());
    }
    refresh();
    const media = window.matchMedia("(display-mode: standalone)");
    media.addEventListener?.("change", refresh);
    return () => media.removeEventListener?.("change", refresh);
  }, []);

  return installed;
}
