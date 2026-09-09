import { auth } from "@/auth";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLicenseStatus } from "@/lib/license";

export const DEFAULT_VENDOR_SLUG = "aliquot";

export class ForbiddenError extends Error {
  constructor(msg = "You don't have permission to do that.") {
    super(msg);
    this.name = "ForbiddenError";
  }
}

export class UnauthenticatedError extends ForbiddenError {
  constructor(msg = "Not signed in.") {
    super(msg);
    this.name = "UnauthenticatedError";
  }
}

export class SubscriptionBlockedError extends ForbiddenError {
  constructor(msg = "This lab’s subscription is not active. Contact Aliquot HQ.") {
    super(msg);
    this.name = "SubscriptionBlockedError";
  }
}

export type TenantUser = {
  userId: string;
  role: Role;
  branchId: string | null;
  vendorId: string;
  vendorSlug: string;
  name: string;
};

function isDbUnavailable(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P1001" || error.code === "P1017" || error.code === "P2024";
  }
  const message = error instanceof Error ? error.message : "";
  return /timed out fetching a new connection|can't reach database|connection pool/i.test(message);
}

function fromSession(userId: string, sessionUser: {
  name?: string | null;
  role?: Role;
  branchId?: string | null;
  vendorId?: string;
  vendorSlug?: string;
}): TenantUser | null {
  if (!sessionUser.role || !sessionUser.vendorId || !sessionUser.vendorSlug) return null;
  return {
    userId,
    role: sessionUser.role,
    branchId: sessionUser.branchId ?? null,
    vendorId: sessionUser.vendorId,
    vendorSlug: sessionUser.vendorSlug,
    name: sessionUser.name ?? "",
  };
}

/** Call at the top of any server action / route handler that mutates data. */
export async function requireRole(...allowed: Role[]) {
  const user = await requireTenant();
  if (!allowed.includes(user.role)) {
    throw new ForbiddenError();
  }
  return user;
}

export async function requireUser() {
  const session = await auth();
  const sessionUser = session?.user as
    | {
        id?: string;
        name?: string | null;
        role?: Role;
        branchId?: string | null;
        vendorId?: string;
        vendorSlug?: string;
      }
    | undefined;
  const userId = sessionUser?.id;
  if (!session?.user || !userId) throw new UnauthenticatedError();

  const cached = fromSession(userId, sessionUser);
  if (cached) return cached;

  let row;
  try {
    row = await prisma.user.findUnique({
      where: { id: userId },
      include: { vendor: { select: { slug: true } } },
    });
  } catch (error) {
    if (isDbUnavailable(error)) throw new UnauthenticatedError();
    throw error;
  }
  if (!row || !row.active) throw new UnauthenticatedError();

  return {
    userId: row.id,
    role: row.role,
    branchId: row.branchId,
    vendorId: row.vendorId,
    vendorSlug: row.vendor.slug,
    name: row.name,
  };
}

export async function requireTenant(): Promise<TenantUser> {
  const user = await requireUser();
  if (!user.vendorId) throw new ForbiddenError("Your account is not assigned to a lab.");
  const license = await getLicenseStatus(user.vendorId, { refreshMs: 0 });
  if (!license.writable) throw new SubscriptionBlockedError(license.message);
  return {
    userId: user.userId,
    role: user.role,
    branchId: user.branchId,
    vendorId: user.vendorId,
    vendorSlug: user.vendorSlug,
    name: user.name,
  };
}

export async function assertWritableLab(vendorId: string) {
  const status = await getLicenseStatus(vendorId);
  if (!status.writable) throw new SubscriptionBlockedError(status.message);
  return status;
}

export async function requireWritableLab(): Promise<TenantUser> {
  const user = await requireUser();
  if (!user.vendorId) throw new ForbiddenError("Your account is not assigned to a lab.");
  await assertWritableLab(user.vendorId);
  return {
    userId: user.userId,
    role: user.role,
    branchId: user.branchId,
    vendorId: user.vendorId,
    vendorSlug: user.vendorSlug,
    name: user.name,
  };
}
