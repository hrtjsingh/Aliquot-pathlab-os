export type ReportHeaderStyle = "classic" | "centered" | "compact";
export type ReportTemplateId = "shiv_clinical" | "modern_teal" | "classic_navy" | "clean_minimal" | "bold_emerald";

export type ReportLayout = {
  templateId: ReportTemplateId;
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

export const REPORT_TEMPLATES: Array<{ id: ReportTemplateId; name: string; description: string; defaultColor: string }> = [
  {
    id: "shiv_clinical",
    name: "Shiv Clinical Standard (Red Header)",
    description: "Classic red letterhead, SCL badge, bordered patient block, shaded department pills, and fixed test-undertaken bottom banner.",
    defaultColor: "#c01515",
  },
  {
    id: "modern_teal",
    name: "Modern Corporate (Teal Accent)",
    description: "Sleek modern header with deep teal accent bar, soft-tinted patient card, and clean tabular result layout.",
    defaultColor: "#0f766e",
  },
  {
    id: "classic_navy",
    name: "Classic Hospital (Navy Header)",
    description: "Formal hospital report layout with bold navy title bar, structured grid table, and formal dual signature line.",
    defaultColor: "#1e3a8a",
  },
  {
    id: "clean_minimal",
    name: "Clean Monochrome (Slate)",
    description: "Publication-grade minimalist black & slate layout. Ideal for pre-printed letterheads or high-volume black & white printing.",
    defaultColor: "#334155",
  },
  {
    id: "bold_emerald",
    name: "Executive Emerald & Gold",
    description: "Premium executive layout with rich emerald green accents, gold borders, flag status pills, and prominent checked-by block.",
    defaultColor: "#047857",
  },
];

export const DEFAULT_REPORT_LAYOUT: ReportLayout = {
  templateId: "shiv_clinical",
  reportTitle: "Laboratory Report",
  headerStyle: "classic",
  primaryColor: "#c01515",
  phone: "",
  email: "",
  website: "",
  subtitle: "",
  footerText:
    "This report is generated electronically and reflects results at time of testing. Results should be interpreted in correlation with clinical findings. For queries, contact the laboratory quoting the accession number above.",
  footerLine2: "Kindly correlate clinically.",
  signTitle: "Checked By",
  signName: "Mr. Naveen kumar",
  signQual: "B.A., D.M.L.T",
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
  const validTemplateIds: ReportTemplateId[] = ["shiv_clinical", "modern_teal", "classic_navy", "clean_minimal", "bold_emerald"];
  const templateId = validTemplateIds.includes(raw.templateId as ReportTemplateId)
    ? (raw.templateId as ReportTemplateId)
    : DEFAULT_REPORT_LAYOUT.templateId;

  const headerStyle =
    raw.headerStyle === "centered" || raw.headerStyle === "compact" || raw.headerStyle === "classic"
      ? raw.headerStyle
      : DEFAULT_REPORT_LAYOUT.headerStyle;
  const primaryColor =
    typeof raw.primaryColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(raw.primaryColor)
      ? raw.primaryColor
      : DEFAULT_REPORT_LAYOUT.primaryColor;

  return {
    templateId,
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
    isDerived: false,
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
    isDerived: false,
    pathologistNote: "Correlate with clinical findings.",
    grossDescription: null,
    microscopicDescription: null,
    diagnosis: null,
    organismPanel: null,
  },
];
