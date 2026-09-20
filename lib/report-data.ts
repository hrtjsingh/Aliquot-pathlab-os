import type { ReportData } from "@/lib/report-pdf";
import { assignPrintGroups } from "@/lib/result-groups";

export function calcAge(dob: Date | null, ageYears: number | null, ageMonths: number | null): string {
  if (dob) {
    const years = Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    if (Number.isFinite(years) && years >= 0 && years < 130) return `${years}y`;
  }
  if (ageYears != null && ageYears >= 0) return `${ageYears}y`;
  if (ageMonths != null && ageMonths >= 0) return `${ageMonths}m`;
  return "—";
}

export function toReportData(order: {
  accessionNo: string;
  referringDoctor: string | null;
  collectedAt: Date | null;
  receivedAt: Date | null;
  reportedAt: Date | null;
  isAmendment: boolean;
  branch: {
    name: string;
    address: string | null;
    nablNo: string | null;
    isoNo: string | null;
    letterheadUrl: string | null;
  };
  patient: {
    firstName: string;
    lastName: string | null;
    dob: Date | null;
    ageYears: number | null;
    ageMonths: number | null;
    gender: string;
    mrn: string;
    phone?: string | null;
    address?: string | null;
  };
  authorizedBy: { name: string; registrationNo: string | null } | null;
  results: Array<{
    isDerived: boolean;
    numericValue: number | null;
    textValue: string | null;
    unit: string | null;
    referenceRangeText: string | null;
    flag: string;
    interpretiveComment: string | null;
    pathologistNote: string | null;
    grossDescription: string | null;
    microscopicDescription: string | null;
    diagnosis: string | null;
    organismPanel: unknown;
    testId?: string;
    test: { name: string; category: string; method?: string | null; decimalPrecision?: number | null; sortOrder?: number | null };
  }>;
  orderTests?: Array<{ testId: string; sortOrder: number }>;
  orderPanels?: Array<{
    panel: {
      code: string;
      name: string;
      description?: string | null;
      panelTests: Array<{ testId: string; sortOrder?: number }>;
    };
  }>;
}): ReportData {
  const lineOrder = new Map((order.orderTests ?? []).map((row) => [row.testId, row.sortOrder]));
  const printable = order.results
    .filter((r) => !r.isDerived || r.numericValue != null || Boolean(r.textValue))
    .slice()
    .sort((a, b) => (lineOrder.get(a.testId ?? "") ?? a.test.sortOrder ?? 0) - (lineOrder.get(b.testId ?? "") ?? b.test.sortOrder ?? 0));

  const grouped = assignPrintGroups(
    printable.map((r) => ({
      testId: r.testId ?? r.test.name,
      category: r.test.category,
      name: r.test.name,
      result: r,
    })),
    order.orderPanels ?? []
  );

  return {
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
      phone: order.patient.phone ?? null,
      address: order.patient.address ?? null,
    },
    accessionNo: order.accessionNo,
    referringDoctor: order.referringDoctor,
    collectedAt: order.collectedAt?.toLocaleString() ?? null,
    receivedAt: order.receivedAt?.toLocaleString() ?? null,
    reportedAt: order.reportedAt?.toLocaleString() ?? null,
    pathologistName: order.authorizedBy ? `Dr. ${order.authorizedBy.name}` : null,
    pathologistRegNo: order.authorizedBy?.registrationNo ?? null,
    isAmended: order.isAmendment,
    results: grouped.map((row) => {
        const r = row.result;
        return {
        testName: r.test.name,
        category: r.test.category,
        groupKey: row.groupKey,
        groupLabel: row.groupLabel,
        groupDescription: row.groupDescription,
        method: r.test.method ?? null,
        memberOrder: row.memberOrder,
        numericValue: r.numericValue,
        textValue: r.textValue,
        unit: r.unit,
        referenceRangeText: r.referenceRangeText,
        flag: r.flag,
        isDerived: r.isDerived,
        decimalPrecision: r.test.decimalPrecision ?? 2,
        pathologistNote: r.pathologistNote,
        comment: r.interpretiveComment ?? r.pathologistNote,
        grossDescription: r.grossDescription,
        microscopicDescription: r.microscopicDescription,
        diagnosis: r.diagnosis,
        organismPanel: r.organismPanel,
      };
      }),
  };
}
