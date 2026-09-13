export type ReportHeaderStyle = "classic" | "centered" | "compact";

export type ReportLayout = {
  reportTitle: string;
  headerStyle: ReportHeaderStyle;
  primaryColor: string;
  phone: string;
  email: string;
  website: string;
  subtitle: string;
  footerText: string;
  footerLine2: string;
  signTitle: string;
  signName: string;
  signQual: string;
  testsUndertaken: string;
  showAddress: boolean;
  showAccreditation: boolean;
  showContact: boolean;
  showCollectionTimes: boolean;
  showPatientMrn: boolean;
  showPatientPhone: boolean;
  showPatientAddress: boolean;
  showReferringDoctor: boolean;
  showReferenceRange: boolean;
  showFlags: boolean;
  showSignature: boolean;
  showFooter: boolean;
  showQrCode: boolean;
  showBarcode: boolean;
};

export const DEFAULT_REPORT_LAYOUT: ReportLayout = {
  reportTitle: "Laboratory Report",
  headerStyle: "classic",
  primaryColor: "#1c3f52",
  phone: "",
  email: "",
  website: "",
  subtitle: "",
  footerText:
    "This report is generated electronically and reflects results at time of testing. Results should be interpreted in correlation with clinical findings. For queries, contact the laboratory quoting the accession number above.",
  footerLine2: "Kindly correlate clinically.",
  signTitle: "Checked By",
  signName: "",
  signQual: "",
  testsUndertaken: "",
  showAddress: true,
  showAccreditation: true,
  showContact: true,
  showPatientMrn: true,
  showPatientPhone: true,
  showPatientAddress: true,
  showReferringDoctor: true,
  showCollectionTimes: true,
  showFlags: true,
  showReferenceRange: true,
  showSignature: true,
  showFooter: true,
  showQrCode: true,
  showBarcode: true,
};

export function parseReportLayout(value: unknown): ReportLayout {
  if (!value || typeof value !== "object") return { ...DEFAULT_REPORT_LAYOUT };
  const raw = value as Partial<Record<keyof ReportLayout, unknown>>;
  const headerStyle =
    raw.headerStyle === "centered" || raw.headerStyle === "compact" || raw.headerStyle === "classic"
      ? raw.headerStyle
      : DEFAULT_REPORT_LAYOUT.headerStyle;
  const primaryColor =
    typeof raw.primaryColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(raw.primaryColor)
      ? raw.primaryColor
      : DEFAULT_REPORT_LAYOUT.primaryColor;

  return {
    reportTitle: typeof raw.reportTitle === "string" && raw.reportTitle.trim() ? raw.reportTitle.trim() : DEFAULT_REPORT_LAYOUT.reportTitle,
    headerStyle,
    primaryColor,
    phone: typeof raw.phone === "string" ? raw.phone : "",
    email: typeof raw.email === "string" ? raw.email : "",
    website: typeof raw.website === "string" ? raw.website : "",
    subtitle: typeof raw.subtitle === "string" ? raw.subtitle : "",
    footerText: typeof raw.footerText === "string" && raw.footerText.trim() ? raw.footerText.trim() : DEFAULT_REPORT_LAYOUT.footerText,
    footerLine2: typeof raw.footerLine2 === "string" ? raw.footerLine2 : DEFAULT_REPORT_LAYOUT.footerLine2,
    signTitle: typeof raw.signTitle === "string" && raw.signTitle.trim() ? raw.signTitle.trim() : DEFAULT_REPORT_LAYOUT.signTitle,
    signName: typeof raw.signName === "string" ? raw.signName : "",
    signQual: typeof raw.signQual === "string" ? raw.signQual : "",
    testsUndertaken: typeof raw.testsUndertaken === "string" ? raw.testsUndertaken : "",
    showAddress: raw.showAddress !== false,
    showAccreditation: raw.showAccreditation !== false,
    showContact: raw.showContact !== false,
    showPatientMrn: raw.showPatientMrn !== false,
    showPatientPhone: raw.showPatientPhone !== false,
    showPatientAddress: raw.showPatientAddress !== false,
    showReferringDoctor: raw.showReferringDoctor !== false,
    showCollectionTimes: raw.showCollectionTimes !== false,
    showFlags: raw.showFlags !== false,
    showReferenceRange: raw.showReferenceRange !== false,
    showSignature: raw.showSignature !== false,
    showFooter: raw.showFooter !== false,
    showQrCode: raw.showQrCode !== false,
    showBarcode: raw.showBarcode !== false,
  };
}

export const SAMPLE_REPORT_RESULTS = [
  {
    testName: "Hemoglobin",
    category: "HEMATOLOGY",
    numericValue: 13.4,
    textValue: null,
    unit: "g/dL",
    referenceRangeText: "12.0 – 15.0",
    flag: "NORMAL",
    pathologistNote: null,
    grossDescription: null,
    microscopicDescription: null,
    diagnosis: null,
    organismPanel: null,
  },
  {
    testName: "Glucose (Fasting)",
    category: "CLINICAL_CHEMISTRY",
    numericValue: 126,
    textValue: null,
    unit: "mg/dL",
    referenceRangeText: "70 – 100",
    flag: "HIGH",
    pathologistNote: "Correlate with clinical findings.",
    grossDescription: null,
    microscopicDescription: null,
    diagnosis: null,
    organismPanel: null,
  },
];
