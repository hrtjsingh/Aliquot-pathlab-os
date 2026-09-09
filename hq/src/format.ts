import type { LabSummary } from "./api.ts";
import { formatPlanPrice } from "../../lib/billing-plans.ts";

export { formatPlanPrice };

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function daysLeft(expiresAt: string) {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
}

export type LeaseTone = "active" | "trial" | "expiring" | "expired" | "suspended" | "missing";

export function leaseTone(lab: Pick<LabSummary, "subscription">): LeaseTone {
  const status = lab.subscription?.status ?? "NONE";
  if (status === "SUSPENDED" || status === "CANCELLED") return "suspended";
  if (!lab.subscription) return "missing";
  const days = daysLeft(lab.subscription.expiresAt);
  if (days <= 0) return "expired";
  if (status === "TRIAL") return "trial";
  if (days <= 14) return "expiring";
  return "active";
}

export function leaseColor(tone: LeaseTone) {
  if (tone === "active") return "#0f766e";
  if (tone === "trial" || tone === "expiring") return "#a15c00";
  return "#b3261e";
}

export function leaseLabel(lab: LabSummary) {
  const tone = leaseTone(lab);
  if (!lab.subscription) return "No lease";
  if (tone === "expired") return `Expired ${formatDate(lab.subscription.expiresAt)}`;
  if (tone === "expiring") return `Ends ${formatDate(lab.subscription.expiresAt)}`;
  return `${lab.subscription.status} · ${formatDate(lab.subscription.expiresAt)}`;
}
