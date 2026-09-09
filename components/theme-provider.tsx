"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { parseTheme, type Theme } from "@/lib/theme";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark" | undefined;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: undefined,
  setTheme: () => {},
});

function systemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function persist(theme: Theme, resolved: "light" | "dark") {
  window.localStorage.setItem("theme", theme);
  const maxAge = "max-age=31536000; path=/; samesite=lax";
  document.cookie = `aliquot-theme=${theme}; ${maxAge}`;
  document.cookie = `aliquot-theme-resolved=${resolved}; ${maxAge}`;
}

function applyTheme(theme: Theme) {
  const resolved = theme === "system" ? systemTheme() : theme;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
  persist(theme, resolved);
  return resolved;
}

export function ThemeProvider({
  children,
  theme: initialTheme,
  resolvedTheme: initialResolved,
}: {
  children: ReactNode;
  theme: Theme;
  resolvedTheme: "light" | "dark";
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(initialResolved);

  useLayoutEffect(() => {
    const stored = parseTheme(window.localStorage.getItem("theme"));
    setThemeState(stored);
    setResolvedTheme(applyTheme(stored));

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function onSystemChange() {
      if (parseTheme(window.localStorage.getItem("theme")) !== "system") return;
      setResolvedTheme(applyTheme("system"));
    }
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    setResolvedTheme(applyTheme(next));
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
