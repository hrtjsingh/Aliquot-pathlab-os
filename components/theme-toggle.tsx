"use client";

import { useTheme } from "@/components/theme-provider";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  function toggle() {
    const current = resolvedTheme || theme;
    setTheme(current === "dark" ? "light" : "dark");
  }

  const isDark = (resolvedTheme || theme) === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon" : "sm"}
      onClick={toggle}
      title={isDark ? "Switch to Light mode" : "Switch to Dark mode"}
      aria-label="Toggle theme appearance"
      className={cn("cursor-pointer select-none transition-colors", className)}
    >
      {isDark ? (
        <Sun className="size-4 text-amber-500 hover:text-amber-400 transition-colors" />
      ) : (
        <Moon className="size-4 text-slate-700 dark:text-slate-200 hover:text-slate-900 transition-colors" />
      )}
      {!compact && (
        <span className="text-xs font-semibold text-foreground">
          {isDark ? "Light Mode" : "Dark Mode"}
        </span>
      )}
    </Button>
  );
}
