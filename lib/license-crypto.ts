import { createPrivateKey, createPublicKey, randomUUID, sign, verify } from "node:crypto";

export const LICENSE_LEASE_VERSION = 1 as const;

export type LeasePayload = {
  v: typeof LICENSE_LEASE_VERSION;
  vendorId: string;
  vendorSlug: string;
  status: string;
  seats: number;
  planCode: string;
  expiresAt: string;
  issuedAt: string;
  nonce: string;
};

export type SignedLease = {
  payload: LeasePayload;
  signature: string;
};

const WRITABLE_STATUSES = new Set(["TRIAL", "ACTIVE"]);

export function isWritableSubscriptionStatus(status: string) {
  return WRITABLE_STATUSES.has(status);
}

export function normalizePem(value: string) {
  return value.replace(/\\n/g, "\n").trim();
}

export function buildLeasePayload(input: {
  vendorId: string;
  vendorSlug: string;
  status: string;
  seats: number;
  planCode: string;
  expiresAt: Date;
}): LeasePayload {
  return {
    v: LICENSE_LEASE_VERSION,
    vendorId: input.vendorId,
    vendorSlug: input.vendorSlug,
    status: input.status,
    seats: input.seats,
    planCode: input.planCode,
    expiresAt: input.expiresAt.toISOString(),
    issuedAt: new Date().toISOString(),
    nonce: randomUUID(),
  };
}

export function signLease(payload: LeasePayload, privateKeyPem: string): string {
  const body = Buffer.from(canonicalJson(payload), "utf8");
  const signature = sign(null, body, createPrivateKey(normalizePem(privateKeyPem)));
  const envelope: SignedLease = { payload, signature: signature.toString("base64") };
  return JSON.stringify(envelope);
}

export function parseSignedLease(raw: string): SignedLease | null {
  try {
    const parsed = JSON.parse(raw) as SignedLease;
    if (!parsed?.payload || typeof parsed.signature !== "string") return null;
    if (parsed.payload.v !== LICENSE_LEASE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function verifySignedLease(raw: string, publicKeyPem: string): LeasePayload | null {
  const envelope = parseSignedLease(raw);
  if (!envelope) return null;
  const body = Buffer.from(canonicalJson(envelope.payload), "utf8");
  const ok = verify(
    null,
    body,
    createPublicKey(normalizePem(publicKeyPem)),
    Buffer.from(envelope.signature, "base64")
  );
  return ok ? envelope.payload : null;
}

export function leaseAllowsWrites(payload: LeasePayload, now = new Date()) {
  if (!isWritableSubscriptionStatus(payload.status)) return false;
  return new Date(payload.expiresAt).getTime() > now.getTime();
}

function canonicalJson(payload: LeasePayload) {
  return JSON.stringify({
    v: payload.v,
    vendorId: payload.vendorId,
    vendorSlug: payload.vendorSlug,
    status: payload.status,
    seats: payload.seats,
    planCode: payload.planCode,
    expiresAt: payload.expiresAt,
    issuedAt: payload.issuedAt,
    nonce: payload.nonce,
  });
}
