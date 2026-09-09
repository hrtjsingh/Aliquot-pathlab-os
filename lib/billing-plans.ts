import { addDays, addMonths } from "date-fns";

export const BILLING_PLANS = [
  { code: "TRIAL", name: "Trial", seats: 1, intervalMonths: 0, intervalDays: 10, priceInr: 0 },
  { code: "M3", name: "3 months", seats: 1, intervalMonths: 3, intervalDays: 0, priceInr: 2000 },
  { code: "M6", name: "6 months", seats: 1, intervalMonths: 6, intervalDays: 0, priceInr: 3500 },
  { code: "Y1", name: "1 year", seats: 1, intervalMonths: 12, intervalDays: 0, priceInr: 6000 },
] as const;

export const LEGACY_PLAN_CODES = ["STARTER", "GROWTH", "ENTERPRISE"];

export function planExpiresAt(
  plan: { intervalMonths: number; intervalDays: number },
  from = new Date()
) {
  if (plan.intervalDays > 0) return addDays(from, plan.intervalDays);
  return addMonths(from, Math.max(1, plan.intervalMonths));
}

export function planIsTrial(code: string) {
  return code === "TRIAL";
}

export function formatPlanPrice(priceInr: number) {
  if (priceInr <= 0) return "Free";
  return `₹${priceInr.toLocaleString("en-IN")}`;
}

export function formatPlanTerm(plan: { intervalMonths: number; intervalDays: number }) {
  if (plan.intervalDays > 0) return `${plan.intervalDays} days`;
  if (plan.intervalMonths === 12) return "1 year";
  return `${plan.intervalMonths} month${plan.intervalMonths === 1 ? "" : "s"}`;
}
