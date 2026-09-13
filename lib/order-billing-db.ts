import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { asMoney } from "@/lib/money";

export type OrderBilling = { totalCharge: number; discount: number; amountPaid: number };

export async function writeOrderBilling(orderId: string, billing: OrderBilling) {
  await prisma.$executeRaw`
    UPDATE "Order"
    SET "totalCharge" = ${billing.totalCharge},
        discount = ${billing.discount},
        "amountPaid" = ${billing.amountPaid}
    WHERE id = ${orderId}
  `;
}

export async function readOrderBilling(orderIds: string[]): Promise<Map<string, OrderBilling>> {
  const result = new Map<string, OrderBilling>();
  if (orderIds.length === 0) return result;
  const rows = await prisma.$queryRaw<Array<{ id: string; totalCharge: unknown; discount: unknown; amountPaid: unknown }>>`
    SELECT id, "totalCharge", discount, "amountPaid"
    FROM "Order"
    WHERE id IN (${Prisma.join(orderIds)})
  `;
  for (const row of rows) {
    result.set(row.id, {
      totalCharge: asMoney(row.totalCharge),
      discount: asMoney(row.discount),
      amountPaid: asMoney(row.amountPaid),
    });
  }
  return result;
}
