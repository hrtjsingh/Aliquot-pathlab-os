import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCloudPrisma } from "@/lib/prisma-cloud";
import {
  leaseAllowsWrites,
  normalizePem,
  type LeasePayload,
  verifySignedLease,
} from "@/lib/license-crypto";

export type LicenseStatus = {
  writable: boolean;
  source: "cloud" | "cache" | "unsigned-dev";
  status: string | null;
  expiresAt: string | null;
  planCode: string | null;
  seats: number | null;
  message: string;
};

let cachedPublicKey: string | null | undefined;

async function loadPublicKeyFromDb(client: PrismaClient) {
  try {
    const row = await client.licenseAuthority.findUnique({
      where: { id: "hq" },
      select: { publicKeyPem: true },
    });
    return row?.publicKeyPem ? normalizePem(row.publicKeyPem) : null;
  } catch {
    return null;
  }
}

/** Local lab PC only — HQ writes this beside the app; never required on Vercel. */
function loadPublicKeyFromLocalFile() {
  const file = path.join(process.cwd(), ".license-public.pem");
  if (existsSync(file)) return normalizePem(readFileSync(file, "utf8"));
  return null;
}

/**
 * Resolve HQ verify key from the backend DB (LicenseAuthority), not from env.
 * Order: Neon CLOUD_DATABASE_URL → app DATABASE_URL → local .license-public.pem (offline lab).
 */
export async function resolvePublicKeyPem() {
  if (cachedPublicKey !== undefined) return cachedPublicKey;

  const cloud = getCloudPrisma();
  if (cloud) {
    const fromCloud = await loadPublicKeyFromDb(cloud);
    if (fromCloud) {
      cachedPublicKey = fromCloud;
      return fromCloud;
    }
  }

  const fromAppDb = await loadPublicKeyFromDb(prisma);
  if (fromAppDb) {
    cachedPublicKey = fromAppDb;
    return fromAppDb;
  }

  const fromFile = loadPublicKeyFromLocalFile();
  if (fromFile) {
    cachedPublicKey = fromFile;
    return fromFile;
  }

  cachedPublicKey = null;
  return null;
}

function denied(partial: Partial<LicenseStatus> & Pick<LicenseStatus, "message">): LicenseStatus {
  return {
    writable: false,
    source: "cache",
    status: null,
    expiresAt: null,
    planCode: null,
    seats: null,
    ...partial,
  };
}

function fromPayload(payload: LeasePayload, source: LicenseStatus["source"]): LicenseStatus {
  const writable = leaseAllowsWrites(payload);
  const expiresAt = payload.expiresAt;
  if (!writable) {
    const expired = new Date(payload.expiresAt).getTime() <= Date.now();
    return {
      writable: false,
      source,
      status: payload.status,
      expiresAt,
      planCode: payload.planCode,
      seats: payload.seats,
      message: expired
        ? "This lab’s subscription has expired. Contact Aliquot HQ to renew."
        : "This lab’s subscription is not active. Contact Aliquot HQ.",
    };
  }
  return {
    writable: true,
    source,
    status: payload.status,
    expiresAt,
    planCode: payload.planCode,
    seats: payload.seats,
    message: `Subscription ${payload.status.toLowerCase()} until ${new Date(expiresAt).toLocaleDateString("en-IN")}.`,
  };
}

function payloadMatchesVendor(payload: LeasePayload, vendor: { id: string; slug: string }) {
  return payload.vendorSlug === vendor.slug || payload.vendorId === vendor.id;
}

async function persistLease(vendorId: string, signedLease: string, payload: LeasePayload) {
  await prisma.licenseCache.upsert({
    where: { vendorId },
    create: {
      vendorId,
      signedLease,
      expiresAt: new Date(payload.expiresAt),
      source: "cloud",
      verifiedAt: new Date(),
    },
    update: {
      signedLease,
      expiresAt: new Date(payload.expiresAt),
      source: "cloud",
      verifiedAt: new Date(),
    },
  });
}

export async function cacheSignedLease(vendorId: string, signedLease: string) {
  const publicKey = await resolvePublicKeyPem();
  if (!publicKey) return null;
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, slug: true } });
  if (!vendor) return null;
  const payload = verifySignedLease(signedLease, publicKey);
  if (!payload || !payloadMatchesVendor(payload, vendor)) return null;
  await persistLease(vendorId, signedLease, payload);
  return payload;
}

async function refreshFromCloud(vendor: { id: string; slug: string }, timeoutMs: number) {
  // Prefer CLOUD_DATABASE_URL; on Vercel the app DB is usually Neon itself.
  const client = getCloudPrisma() ?? (process.env.VERCEL ? prisma : null);
  if (!client) return { reachable: false as const, signedLease: null as string | null };
  return refreshLeaseFromClient(client, vendor, timeoutMs);
}

async function refreshLeaseFromClient(
  client: typeof prisma,
  vendor: { id: string; slug: string },
  timeoutMs: number
) {
  try {
    const timedOut = Symbol("timeout");
    const sub = await Promise.race([
      client.subscription.findFirst({
        where: { OR: [{ vendorId: vendor.id }, { vendor: { slug: vendor.slug } }] },
        select: { signedLease: true },
      }),
      new Promise<typeof timedOut>((resolve) => setTimeout(() => resolve(timedOut), timeoutMs)),
    ]);
    if (sub === timedOut) return { reachable: false as const, signedLease: null as string | null };
    return { reachable: true as const, signedLease: sub?.signedLease || null };
  } catch {
    return { reachable: false as const, signedLease: null as string | null };
  }
}

function evaluateCached(raw: string | null | undefined, publicKey: string, vendor: { id: string; slug: string }) {
  if (!raw) return null;
  const payload = verifySignedLease(raw, publicKey);
  if (!payload || !payloadMatchesVendor(payload, vendor)) return null;
  return payload;
}

export async function getLicenseStatus(
  vendorId: string,
  options: { refreshMs?: number } = { refreshMs: 800 }
): Promise<LicenseStatus> {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, slug: true } });
  if (!vendor) return denied({ message: "Lab was not found." });

  const publicKey = await resolvePublicKeyPem();
  const cloud =
    options.refreshMs && options.refreshMs > 0
      ? await refreshFromCloud(vendor, options.refreshMs)
      : { reachable: false as const, signedLease: null as string | null };

  if (cloud.reachable && cloud.signedLease && publicKey) {
    const payload = verifySignedLease(cloud.signedLease, publicKey);
    if (payload && payloadMatchesVendor(payload, vendor)) {
      await persistLease(vendorId, cloud.signedLease, payload);
      return fromPayload(payload, "cloud");
    }
    return denied({
      source: "cloud",
      message: "HQ subscription lease is invalid. Contact Aliquot HQ.",
    });
  }

  if (cloud.reachable && !cloud.signedLease) {
    return denied({
      source: "cloud",
      message: "No HQ subscription is on file for this lab. Contact Aliquot HQ.",
    });
  }

  const [cache, localSub] = await Promise.all([
    prisma.licenseCache.findUnique({ where: { vendorId } }),
    prisma.subscription.findUnique({ where: { vendorId }, select: { signedLease: true } }),
  ]);
  if (publicKey) {
    const cachedPayload = evaluateCached(cache?.signedLease, publicKey, vendor);
    const localPayload = evaluateCached(localSub?.signedLease, publicKey, vendor);
    const winner = [cachedPayload, localPayload]
      .filter((row): row is LeasePayload => Boolean(row))
      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())[0];
    if (winner) {
      const raw = winner === localPayload ? localSub?.signedLease : cache?.signedLease;
      if (raw) await persistLease(vendorId, raw, winner);
      return fromPayload(winner, "cache");
    }
    return denied({
      message:
        cache || localSub
          ? "Local subscription rows are not HQ-signed. Extending dates in the lab database does not grant access."
          : "No signed HQ subscription is cached. Connect once so this lab can download its lease.",
    });
  }

  return {
    writable: true,
    source: "unsigned-dev",
    status: null,
    expiresAt: null,
    planCode: null,
    seats: null,
    message:
      "Subscription authority is not published yet. Start Aliquot HQ on Live Neon once so this backend can verify signed leases.",
  };
}
