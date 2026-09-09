import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { LabReportDocument } from "@/lib/report-pdf";
import { parseReportLayout } from "@/lib/report-layout";
import { toReportData } from "@/lib/report-data";
import { prisma } from "@/lib/prisma";
import { qrPngDataUrl } from "@/lib/qr";
import { absolutePublicReportUrl, findReleasedOrderByToken, reportOriginFromRequest } from "@/lib/public-report";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await findReleasedOrderByToken(token);
  if (!order) return NextResponse.json({ error: "Report is not available." }, { status: 404 });

  const template = await prisma.reportTemplate.findFirst({
    where: { branchId: order.branchId, vendorId: order.vendorId, isDefault: true },
  });
  const layout = parseReportLayout(template?.layoutJson);
  const data = toReportData(order);

  if (layout.showQrCode) {
    data.qrCodeDataUrl = await qrPngDataUrl(absolutePublicReportUrl(reportOriginFromRequest(req), token));
  }

  const buffer = await renderToBuffer(<LabReportDocument data={data} layout={layout} />);
  const download = req.nextUrl.searchParams.get("download") === "1";

  await logAudit({
    vendorId: order.vendorId,
    orderId: order.id,
    action: download ? "REPORT_PUBLIC_DOWNLOADED" : "REPORT_PUBLIC_VIEWED",
    entityType: "Order",
    entityId: order.id,
  });

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="report-${order.accessionNo}.pdf"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
