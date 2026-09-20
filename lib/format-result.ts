export function roundNumeric(value: number, precision: number | null | undefined): number {
  const places = Number.isFinite(precision) ? Math.max(0, Math.min(6, Math.trunc(precision as number))) : 2;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function formatNumericValue(value: number | null | undefined, precision: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const places = Number.isFinite(precision) ? Math.max(0, Math.min(6, Math.trunc(precision as number))) : 2;
  return roundNumeric(value, places).toFixed(places);
}

export function numericValuesEqual(a: number | null | undefined, b: number | null | undefined, precision = 4): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 10 ** -(precision + 1);
}
