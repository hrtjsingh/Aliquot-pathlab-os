export type Theme = "light" | "dark" | "system";

export function parseTheme(value?: string | null): Theme {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function parseResolvedTheme(value?: string | null): "light" | "dark" {
  return value === "dark" ? "dark" : "light";
}

export function resolvedFromPreference(preference: Theme, storedResolved?: string | null): "light" | "dark" {
  if (preference === "light" || preference === "dark") return preference;
  return parseResolvedTheme(storedResolved);
}
