import { auth } from "@/auth";
import { Role } from "@prisma/client";

export class ForbiddenError extends Error {
  constructor(msg = "You don't have permission to do that.") {
    super(msg);
  }
}

/** Call at the top of any server action / route handler that mutates data. */
export async function requireRole(...allowed: Role[]) {
  const session = await auth();
  const role = (session?.user as any)?.role as Role | undefined;
  if (!session?.user || !role || !allowed.includes(role)) {
    throw new ForbiddenError();
  }
  return { userId: (session.user as any).id as string, role, branchId: (session.user as any).branchId as string | null };
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new ForbiddenError("Not signed in.");
  return {
    userId: (session.user as any).id as string,
    role: (session.user as any).role as Role,
    branchId: (session.user as any).branchId as string | null,
    name: session.user.name ?? "",
  };
}
