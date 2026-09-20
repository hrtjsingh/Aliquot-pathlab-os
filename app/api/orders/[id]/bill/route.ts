import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/rbac";
import { fetchCashReceipt } from "@/lib/cash-receipt";
import { renderCashBillHtml } from "@/lib/bill-html";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireTenant();
  const { id } = await params;
  const receipt = await fetchCashReceipt(id, user.vendorId);
  if (!receipt) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  await logAudit({
    userId: user.userId,
    vendorId: user.vendorId,
    orderId: id,
    action: "RECEIPT_PRINTED",
    entityType: "Order",
    entityId: id,
  });

  return new NextResponse(renderCashBillHtml(receipt.data, receipt.layout), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
