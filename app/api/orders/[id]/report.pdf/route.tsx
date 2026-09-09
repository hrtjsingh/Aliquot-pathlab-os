import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { renderToBuffer } from "@react-pdf/renderer";
import { LabReportDocument, ReportData } from "@/lib/report-pdf";
import { logAudit } from "@/lib/audit";
import { getReportLayoutForBranch } from "@/app/actions/lab";

function calcAge(dob: Date | null, ageYears: number | null, ageMonths: number | null): string {
  if (dob) {
    const years = Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    return `${years}y`;
  }
  if (ageYears) return `${ageYears}y`;
  if (ageMonths) return `${ageMonths}m`;
  return "—";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      patient: true,
      branch: true,
      authorizedBy: true,
      results: { include: { test: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const layout = await getReportLayoutForBranch(order.branchId);

  const data: ReportData = {
    branch: {
      name: order.branch.name,
      address: order.branch.address,
      nablNo: order.branch.nablNo,
      isoNo: order.branch.isoNo,
      letterheadUrl: order.branch.letterheadUrl,
    },
    patient: {
      name: `${order.patient.firstName} ${order.patient.lastName ?? ""}`.trim(),
      age: calcAge(order.patient.dob, order.patient.ageYears, order.patient.ageMonths),
      gender: order.patient.gender,
      mrn: order.patient.mrn,
    },
    accessionNo: order.accessionNo,
    referringDoctor: order.referringDoctor,
    collectedAt: order.collectedAt?.toLocaleString() ?? null,
    receivedAt: order.receivedAt?.toLocaleString() ?? null,
    reportedAt: order.reportedAt?.toLocaleString() ?? null,
    pathologistName: order.authorizedBy ? `Dr. ${order.authorizedBy.name}` : null,
    pathologistRegNo: order.authorizedBy?.registrationNo ?? null,
    isAmended: order.isAmendment,
    results: order.results
      .filter((r) => !r.isDerived || r.numericValue != null)
      .map((r) => ({
        testName: r.test.name,
        category: r.test.category,
        numericValue: r.numericValue,
        textValue: r.textValue,
        unit: r.unit,
        referenceRangeText: r.referenceRangeText,
        flag: r.flag,
        pathologistNote: r.pathologistNote,
        grossDescription: r.grossDescription,
        microscopicDescription: r.microscopicDescription,
        diagnosis: r.diagnosis,
        organismPanel: r.organismPanel,
      })),
  };

  const buffer = await renderToBuffer(<LabReportDocument data={data} layout={layout} />);

  await logAudit({ userId: user.userId, orderId: order.id, action: "REPORT_PRINTED", entityType: "Order", entityId: order.id });

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="report-${order.accessionNo}.pdf"`,
    },
  });
}
