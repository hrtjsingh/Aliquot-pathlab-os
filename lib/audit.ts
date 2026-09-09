import { prisma } from "@/lib/prisma";

export async function logAudit(params: {
  userId?: string | null;
  orderId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      orderId: params.orderId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      beforeJson: params.before === undefined ? undefined : (params.before as any),
      afterJson: params.after === undefined ? undefined : (params.after as any),
      ipAddress: params.ipAddress ?? null,
    },
  });
}
