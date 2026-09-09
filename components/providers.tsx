"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { PwaProvider } from "@/components/pwa-provider";
import type { Theme } from "@/lib/theme";

export function Providers({
  children,
  theme,
  resolvedTheme,
}: {
  children: ReactNode;
  theme: Theme;
  resolvedTheme: "light" | "dark";
}) {
  return (
    <ThemeProvider theme={theme} resolvedTheme={resolvedTheme}>
      <TooltipProvider delayDuration={200}>
        <PwaProvider>
          {children}
          <Toaster />
        </PwaProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
