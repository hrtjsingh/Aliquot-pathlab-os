import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_REPORT_STATUSES } from "@/lib/workflow";

export function newPublicReportToken() {
  return randomBytes(18).toString("base64url");
}

export function publicReportPath(token: string) {
  return `/r/${token}`;
}

export function absolutePublicReportUrl(origin: string, token: string) {
  return `${origin.replace(/\/$/, "")}${publicReportPath(token)}`;
}

export function reportOriginFromRequest(request: Request) {
  return reportOriginFromHeaderList((name) => request.headers.get(name));
}

export function reportOriginFromHeaderList(getHeader: (name: string) => string | null) {
  const configured = process.env.APP_URL?.trim() || process.env.AUTH_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const host = getHeader("x-forwarded-host") ?? getHeader("host");
  if (!host) return "http://localhost:3000";
  const proto = getHeader("x-forwarded-proto") ?? (host.includes("localhost") || host.startsWith("127.") || host.startsWith("192.168.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function ensurePublicReportToken(orderId: string) {
  const existing = await prisma.order.findUnique({ where: { id: orderId }, select: { publicToken: true } });
  if (existing?.publicToken) return existing.publicToken;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = newPublicReportToken();
    try {
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { publicToken: token },
        select: { publicToken: true },
      });
      if (updated.publicToken) return updated.publicToken;
    } catch {
      const again = await prisma.order.findUnique({ where: { id: orderId }, select: { publicToken: true } });
      if (again?.publicToken) return again.publicToken;
    }
  }

  throw new Error("Could not issue a public report link.");
}

export async function findReleasedOrderByToken(token: string) {
  const cleaned = token.trim();
  if (!cleaned) return null;
  return prisma.order.findFirst({
    where: { publicToken: cleaned, status: { in: CUSTOMER_REPORT_STATUSES } },
    include: {
      patient: true,
      branch: true,
      authorizedBy: true,
      results: { include: { test: true } },
    },
  });
}
