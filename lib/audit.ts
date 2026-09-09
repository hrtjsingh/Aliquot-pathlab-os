import { prisma } from "@/lib/prisma";

export async function logAudit(params: {
  vendorId?: string | null;
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
      vendorId: params.vendorId ?? null,
      userId: params.userId ?? null,
      orderId: params.orderId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      beforeJson: params.before === undefined ? undefined : (params.before as never),
      afterJson: params.after === undefined ? undefined : (params.after as never),
      ipAddress: params.ipAddress ?? null,
    },
  });
}
