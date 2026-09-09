import type { ReportData } from "@/lib/report-pdf";

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
  };
  authorizedBy: { name: string; registrationNo: string | null } | null;
  results: Array<{
    isDerived: boolean;
    numericValue: number | null;
    textValue: string | null;
    unit: string | null;
    referenceRangeText: string | null;
    flag: string;
    pathologistNote: string | null;
    grossDescription: string | null;
    microscopicDescription: string | null;
    diagnosis: string | null;
    organismPanel: unknown;
    test: { name: string; category: string };
  }>;
}): ReportData {
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
}
