export function asMoney(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function dueAmount(totalCharge: unknown, discount: unknown, amountPaid: unknown): number {
  return Math.max(0, asMoney(asMoney(totalCharge) - asMoney(discount) - asMoney(amountPaid)));
}

export function formatInr(value: unknown): string {
  return `₹${asMoney(value).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
