import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { LabReportDocument, type ReportData } from "@/lib/report-pdf";
import { parseReportLayout, SAMPLE_REPORT_RESULTS, type ReportLayout } from "@/lib/report-layout";
import { getLabConfig } from "@/app/actions/lab";
import { qrPngDataUrl } from "@/lib/qr";
import { reportOriginFromRequest } from "@/lib/public-report";

function sampleData(branch: {
  name: string;
  address: string | null;
  nablNo: string | null;
  isoNo: string | null;
  letterheadUrl: string | null;
}): ReportData {
  return {
    branch,
    patient: { name: "Anita Kapoor", age: "42y", gender: "FEMALE", mrn: "MRN-1001" },
    accessionNo: "MAIN-SAMPLE",
    referringDoctor: "Dr. Mehta",
    collectedAt: "09 Sep 2026, 08:10",
    receivedAt: "09 Sep 2026, 08:25",
    reportedAt: "09 Sep 2026, 11:40",
    pathologistName: "Dr. Anita Rao",
    pathologistRegNo: "MCI-12345",
    isAmended: false,
    results: SAMPLE_REPORT_RESULTS,
  };
}

async function pdfResponse(request: Request, data: ReportData, layout: ReportLayout) {
  if (layout.showQrCode) {
    data.qrCodeDataUrl = await qrPngDataUrl(`${reportOriginFromRequest(request)}/r/preview-sample`);
  }
  const buffer = await renderToBuffer(<LabReportDocument data={data} layout={layout} />);
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="lab-report-sample.pdf"',
    },
  });
}

export async function GET(request: Request) {
  await requireRole(Role.ADMIN);
  const config = await getLabConfig();
  return pdfResponse(
    request,
    sampleData({
      name: config.branch.name,
      address: config.branch.address || null,
      nablNo: config.branch.nablNo || null,
      isoNo: config.branch.isoNo || null,
      letterheadUrl: config.branch.letterheadUrl || null,
    }),
    config.layout
  );
}

export async function POST(request: Request) {
  await requireRole(Role.ADMIN);
  const body = (await request.json()) as {
    branch?: {
      name?: string;
      address?: string;
      nablNo?: string;
      isoNo?: string;
      letterheadUrl?: string;
    };
    layout?: unknown;
  };

  return pdfResponse(
    request,
    sampleData({
      name: body.branch?.name?.trim() || "Laboratory",
      address: body.branch?.address?.trim() || null,
      nablNo: body.branch?.nablNo?.trim() || null,
      isoNo: body.branch?.isoNo?.trim() || null,
      letterheadUrl: body.branch?.letterheadUrl?.trim() || null,
    }),
    parseReportLayout(body.layout)
  );
}
