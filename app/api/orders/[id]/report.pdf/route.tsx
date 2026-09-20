import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/rbac";
import { renderToBuffer } from "@react-pdf/renderer";
import { LabReportDocument } from "@/lib/report-pdf";
import { logAudit } from "@/lib/audit";
import { getReportLayoutForBranch } from "@/app/actions/lab";
import { toReportData } from "@/lib/report-data";
import { prisma } from "@/lib/prisma";
import { qrPngDataUrl } from "@/lib/qr";
import { absolutePublicReportUrl, ensurePublicReportToken, reportOriginFromRequest } from "@/lib/public-report";
import { isCustomerVisibleReport } from "@/lib/workflow";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireTenant();
  const { id } = await params;

  const order = await prisma.order.findFirst({
    where: { id, vendorId: user.vendorId },
    include: {
      patient: true,
      branch: true,
      authorizedBy: true,
      results: { include: { test: true } },
      orderTests: { select: { testId: true, sortOrder: true } },
      orderPanels: { include: { panel: { include: { panelTests: { orderBy: { sortOrder: "asc" } } } } } },
    },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!isCustomerVisibleReport(order.status)) {
    return NextResponse.json({ error: "Report is not released." }, { status: 404 });
  }

  const layout = await getReportLayoutForBranch(order.branchId, user.vendorId);
  const data = toReportData(order);

  if (layout.showQrCode) {
    const token = await ensurePublicReportToken(order.id);
    data.qrCodeDataUrl = await qrPngDataUrl(absolutePublicReportUrl(reportOriginFromRequest(req), token));
  }

  const buffer = await renderToBuffer(<LabReportDocument data={data} layout={layout} />);

  await logAudit({ userId: user.userId, vendorId: user.vendorId, orderId: order.id, action: "REPORT_PRINTED", entityType: "Order", entityId: order.id });

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="report-${order.accessionNo}.pdf"`,
    },
  });
}
