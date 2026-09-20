import {
  Gender,
  PrismaClient,
  ResultDataType,
  TestCategory,
} from "@prisma/client";
import { CATALOG_LINES } from "./master-catalog";

type SourceCategory =
  | "BIOCHEMISTRY"
  | "HAEMATOLOGY"
  | "SEROLOGY"
  | "HORMONE"
  | "VITAMIN"
  | "URINE"
  | "STOOL"
  | "SEMEN"
  | "MICROBIOLOGY"
  | "SPUTUM"
  | "TUMOR MARKER"
  | "SPECIAL TEST"
  | "MOLECULAR BIOLOGY"
  | "HISTOPATH"
  | "CYTOLOGY";

type CatalogRow = {
  sourceCategory: SourceCategory;
  name: string;
  unit: string;
  range: string;
  charge: number;
  formula: string;
};

type ParsedRange = {
  gender: Gender | null;
  low: number | null;
  high: number | null;
  textRange: string | null;
};

const CATEGORY_MAP: Record<SourceCategory, TestCategory> = {
  BIOCHEMISTRY: "CLINICAL_CHEMISTRY",
  HAEMATOLOGY: "HEMATOLOGY",
  SEROLOGY: "SEROLOGY_IMMUNOLOGY",
  HORMONE: "ENDOCRINE",
  VITAMIN: "ENDOCRINE",
  URINE: "URINALYSIS",
  STOOL: "OTHER",
  SEMEN: "OTHER",
  MICROBIOLOGY: "MICROBIOLOGY",
  SPUTUM: "MICROBIOLOGY",
  "TUMOR MARKER": "OTHER",
  "SPECIAL TEST": "OTHER",
  "MOLECULAR BIOLOGY": "MOLECULAR",
  HISTOPATH: "HISTOPATHOLOGY",
  CYTOLOGY: "CYTOLOGY",
};

const SPECIMEN_BY_CATEGORY: Record<SourceCategory, string> = {
  BIOCHEMISTRY: "Serum",
  HAEMATOLOGY: "Whole Blood EDTA",
  SEROLOGY: "Serum",
  HORMONE: "Serum",
  VITAMIN: "Serum",
  URINE: "Urine",
  STOOL: "Stool",
  SEMEN: "Semen",
  MICROBIOLOGY: "Varies",
  SPUTUM: "Sputum",
  "TUMOR MARKER": "Serum",
  "SPECIAL TEST": "Serum",
  "MOLECULAR BIOLOGY": "Specimen",
  HISTOPATH: "Tissue",
  CYTOLOGY: "Aspirate",
};

/** Keep existing seed codes so historical orders and calc rules still resolve. */
const CODE_BY_NAME: Record<string, string> = {
  "Haemoglobin (Hb)": "HB",
  "RBC Count": "RBC",
  "HCT (PCV) / Haematocrit": "HCT",
  "Total WBC Count (TLC)": "TLC",
  Neutrophils: "NEUT_PCT",
  Lymphocytes: "LYMPH_PCT",
  Monocytes: "MONO_PCT",
  Eosinophils: "EOS_PCT",
  Basophils: "BASO_PCT",
  "Platelet Count": "PLATELET",
  MCV: "MCV",
  MCH: "MCH",
  MCHC: "MCHC",
  "Absolute Neutrophils Count": "ANC",
  "Absolute Lymphocytes Count": "ALC",
  "Absolute Monocytes Count": "AMC",
  "Absolute Eosinophils Count (AEC)": "AEC",
  "Absolute Basophils Count": "ABC",
  "SGOT (AST)": "AST",
  "SGPT (ALT)": "ALT",
  "Sr.Albumin": "ALBUMIN",
  "Total Protein": "TOTAL_PROTEIN",
  "Sr.Creatinine": "CREATININE",
  "Blood Urea": "UREA",
  "Bun Urea (BUN)": "BUN",
  "Sr.Calcium / Total Calcium": "CALCIUM",
  "Sr.Sodium / Na+": "SODIUM",
  "Sr.Potassium / K+": "POTASSIUM",
  "Sr.Chloride / Cl-": "CHLORIDE",
  "HCO3 (Bicarbonate)": "BICARBONATE",
  "Blood Sugar Fasting (BSF)": "GLUCOSE",
  "Total Cholesterol": "TOTAL_CHOLESTEROL",
  "HDL Cholesterol": "HDL",
  "Sr.Triglycerides": "TRIGLYCERIDES",
  "LDL Cholesterol": "LDL",
  "BUN/Creatinine Ratio": "BUN_CR_RATIO",
  "A/G Ratio": "AG_RATIO",
  "Anion Gap": "ANION_GAP",
  "Total Chol/HDL Ratio": "TC_HDL_RATIO",
  HBA1C: "HBA1C",
  "Estimated Average Glucose": "EAG",
  "Sr.Globulin": "GLOBULIN",
  "Total Bilirubin": "TBIL",
  "Direct Bilirubin": "DBIL",
  "Indirect Bilirubin": "IBIL",
  "VLDL Cholesterol": "VLDL",
  "LDL Chol/HDL Chol Ratio": "LDL_HDL_RATIO",
  "Prothrombin Time (PT)": "PT",
  "Patient's Prothrombin Time": "PATIENT_PT",
  "Control's Prothrombin Time": "MEAN_NORMAL_PT",
  INR: "INR",
};

/** Duplicate rows that should not create a second test. */
const SKIP_NAMES = new Set([
  "Glucose",
  "Blood Urea Nitrogen",
  "Thyroid Stimulating Hormone",
]);

const RULE_BY_NAME: Record<string, string> = {
  "Estimated Average Glucose": "EAG_FROM_HBA1C",
  "Bun Urea (BUN)": "BUN_FROM_UREA",
  "BUN/Creatinine Ratio": "BUN_CREATININE_RATIO",
  "LDL Cholesterol": "LDL_FRIEDEWALD",
  "VLDL Cholesterol": "VLDL_FROM_TG",
  "Total Chol/HDL Ratio": "TC_HDL_RATIO",
  "LDL Chol/HDL Chol Ratio": "LDL_HDL_RATIO",
  "Sr.Globulin": "GLOBULIN_FROM_PROTEIN",
  "A/G Ratio": "AG_RATIO",
  "Indirect Bilirubin": "INDIRECT_BILIRUBIN",
  MCV: "MCV",
  MCH: "MCH",
  MCHC: "MCHC",
  "Absolute Neutrophils Count": "ANC",
  "Absolute Lymphocytes Count": "ALC",
  "Absolute Monocytes Count": "AMC",
  "Absolute Eosinophils Count (AEC)": "AEC",
  "Absolute Basophils Count": "ABC",
  "Anion Gap": "ANION_GAP",
  Monocytes: "MONO_FROM_DIFF",
  Basophils: "BASO_FROM_DIFF",
  INR: "INR",
};

const QUALITATIVE_WORDS = new Set(
  [
    "negative",
    "non-reactive",
    "nil",
    "not seen",
    "not detected",
    "clear",
    "pale yellow",
    "brown",
    "semi-solid",
    "few",
    "absent",
    "normal flora",
    "positive",
    "characteristic",
    "greyish white",
    "normal",
    "no growth",
    "varies by phase",
    "varies by age",
    "varies by age/sex",
  ].map((s) => s.toLowerCase())
);

type PanelDef = {
  code: string;
  name: string;
  category: TestCategory;
  price: number;
  members: string[];
};

const PANEL_DEFS: PanelDef[] = [
  {
    code: "BS_F_PM",
    name: "Blood Sugar (F) & (PM)",
    category: "CLINICAL_CHEMISTRY",
    price: 100,
    members: ["Blood Sugar Fasting (BSF)", "Blood Sugar Postmeal (PM)"],
  },
  {
    code: "KFT",
    name: "Kidney Profile (KFT)",
    category: "CLINICAL_CHEMISTRY",
    price: 350,
    members: ["Blood Urea", "Bun Urea (BUN)", "Sr.Creatinine", "BUN/Creatinine Ratio", "Uric Acid"],
  },
  {
    code: "LFT",
    name: "Liver Function Test (LFT)",
    category: "CLINICAL_CHEMISTRY",
    price: 700,
    members: [
      "Total Bilirubin",
      "Direct Bilirubin",
      "Indirect Bilirubin",
      "SGOT (AST)",
      "SGPT (ALT)",
      "Serum Alkaline PO4 (ALP)",
      "Total Protein",
      "Sr.Albumin",
      "Sr.Globulin",
      "A/G Ratio",
    ],
  },
  {
    code: "RFT",
    name: "Renal Function Test (RFT)",
    category: "CLINICAL_CHEMISTRY",
    price: 450,
    members: [
      "Blood Urea",
      "Bun Urea (BUN)",
      "Sr.Creatinine",
      "BUN/Creatinine Ratio",
      "Uric Acid",
      "Sr.Sodium / Na+",
      "Sr.Potassium / K+",
      "Sr.Chloride / Cl-",
    ],
  },
  {
    code: "ELECTROLYTES",
    name: "Electrolytes",
    category: "CLINICAL_CHEMISTRY",
    price: 500,
    members: ["Sr.Sodium / Na+", "Sr.Potassium / K+", "Sr.Chloride / Cl-"],
  },
  {
    code: "LIPID",
    name: "Lipid Profile",
    category: "CLINICAL_CHEMISTRY",
    price: 500,
    members: [
      "Total Cholesterol",
      "Sr.Triglycerides",
      "HDL Cholesterol",
      "LDL Cholesterol",
      "VLDL Cholesterol",
      "Total Chol/HDL Ratio",
      "LDL Chol/HDL Chol Ratio",
    ],
  },
  {
    code: "ABG",
    name: "Arterial Blood Gases (ABG)",
    category: "CLINICAL_CHEMISTRY",
    price: 600,
    members: ["pH (ABG)", "pCO2", "pO2", "HCO3 (Bicarbonate)", "BE (b)", "BE (ecf)", "cTCO2"],
  },
  {
    code: "CBC",
    name: "CBC",
    category: "HEMATOLOGY",
    price: 250,
    members: [
      "Haemoglobin (Hb)",
      "RBC Count",
      "Total WBC Count (TLC)",
      "Platelet Count",
      "Neutrophils",
      "Lymphocytes",
      "Monocytes",
      "Eosinophils",
      "Basophils",
      "Absolute Neutrophils Count",
      "Absolute Lymphocytes Count",
      "Absolute Monocytes Count",
      "Absolute Eosinophils Count (AEC)",
      "Absolute Basophils Count",
      "MCV",
      "MCH",
      "MCHC",
      "HCT (PCV) / Haematocrit",
      "RDW-CV",
      "MPV",
    ],
  },
  {
    code: "COAG",
    name: "Coagulation Profile",
    category: "COAGULATION",
    price: 200,
    members: ["Bleeding Time (BT)", "Clotting Time (CT)", "Prothrombin Time (PT)", "Control's Prothrombin Time", "Patient's Prothrombin Time", "INR", "APTT (PTTK)"],
  },
  {
    code: "BT_CT",
    name: "Bleeding Time & Clotting Time",
    category: "COAGULATION",
    price: 0,
    members: ["Bleeding Time (BT)", "Clotting Time (CT)"],
  },
  {
    code: "TFT",
    name: "Thyroid Function Test (TFT)",
    category: "ENDOCRINE",
    price: 500,
    members: ["T3", "T4", "TSH"],
  },
  {
    code: "FREE_TFT",
    name: "Free Thyroid Profile",
    category: "ENDOCRINE",
    price: 500,
    members: ["Free T3", "Free T4", "TSH"],
  },
  {
    code: "FERTILITY",
    name: "Fertility Profile",
    category: "ENDOCRINE",
    price: 1200,
    members: [
      "FSH (Follicle Stimulating Hormone)",
      "LH (Lutenising Hormone)",
      "Prolactin",
      "Progesterone",
      "Estradiol (E2)",
      "Testosterone",
    ],
  },
  {
    code: "TORCH_IGG",
    name: "TORCH Panel, IgG Panel",
    category: "SEROLOGY_IMMUNOLOGY",
    price: 1200,
    members: [
      "Herpes Simplex Virus I+2 IgG",
      "Cytomegalovirus IgG",
      "Rubella IgG",
      "Toxoplasma IgG",
    ],
  },
  {
    code: "CUE",
    name: "Complete Urine Examination",
    category: "URINALYSIS",
    price: 100,
    members: [
      "Colour (Urine)",
      "Appearance (Urine)",
      "Reaction (pH)",
      "Specific Gravity",
      "Albumin (Urine)",
      "Sugar (Urine)",
      "Ketone (Urine)",
      "Bile Salt",
      "Bile Pigment",
      "Urobilinogen",
      "Nitrite",
      "Blood (Urine)",
      "Pus Cell",
      "RBC's (Urine)",
      "Epithelial Cell",
      "Casts (Urine)",
      "Crystal",
      "Bacteria (Urine)",
    ],
  },
  {
    code: "URINE_ROUTINE",
    name: "Urine Routine",
    category: "URINALYSIS",
    price: 100,
    members: [
      "Colour (Urine)",
      "Appearance (Urine)",
      "Reaction (pH)",
      "Specific Gravity",
      "Albumin (Urine)",
      "Sugar (Urine)",
      "Pus Cell",
      "RBC's (Urine)",
      "Epithelial Cell",
    ],
  },
  {
    code: "STOOL_COMPLETE",
    name: "Complete Stool Examination",
    category: "OTHER",
    price: 100,
    members: [
      "Colour (Stool)",
      "Consistency",
      "Reducing Sugar (Stool)",
      "Occult Blood (Stool)",
      "Pus Cell (Stool)",
      "RBC's (Stool)",
      "Epithelial Cells (Stool)",
      "Mucus",
      "Fat Globules",
      "Cyst",
      "Trophozoites",
      "Ova",
      "Parasites",
    ],
  },
  {
    code: "STOOL_EXAM",
    name: "Stool Examination",
    category: "OTHER",
    price: 0,
    members: [
      "Colour (Stool)",
      "Consistency",
      "Occult Blood (Stool)",
      "Pus Cell (Stool)",
      "Cyst",
      "Ova",
      "Parasites",
    ],
  },
  {
    code: "SEMEN_COMPLETE",
    name: "Complete Semen Examination",
    category: "OTHER",
    price: 250,
    members: [
      "Colour (Semen)",
      "Volume",
      "(pH) Reaction",
      "Liquefaction Time",
      "Viscosity",
      "Total Sperm Count",
      "Active Motile 1hr",
      "Sluggish Motile 1hr",
      "Non-Motile 1hr",
      "Normal (Morphology)",
      "Abnormal (Morphology)",
      "Pus Cell (Semen)",
      "Fructose Test",
    ],
  },
  {
    code: "SEMEN_EXAM",
    name: "Semen Examination",
    category: "OTHER",
    price: 0,
    members: [
      "Colour (Semen)",
      "Volume",
      "Total Sperm Count",
      "Active Motile 1hr",
      "Normal (Morphology)",
      "Pus Cell (Semen)",
    ],
  },
  {
    code: "BREAST_MONITOR",
    name: "Breast Monitor Panel",
    category: "OTHER",
    price: 500,
    members: ["CEA (Carcinoembryonic Antigen)", "CA 15.3", "CA-125"],
  },
  {
    code: "LYMPH_ENUM",
    name: "Lymphocyte Enumeration",
    category: "HEMATOLOGY",
    price: 50,
    members: ["CD3+ Lymphocyte", "CD4+ T Helper", "CD8+ T Killer", "CD4:CD8 Ratio"],
  },
  {
    code: "PROT_EP",
    name: "Protein Electrophoresis",
    category: "OTHER",
    price: 0,
    members: ["Albumin (Special)", "Alpha1 Globulin", "Alpha2 Globulin", "Beta Globulin", "Gamma Globulin"],
  },
  {
    code: "HPLC",
    name: "Hemoglobinopathy by HPLC",
    category: "HEMATOLOGY",
    price: 800,
    members: [
      "Hemoglobin A (HbA)",
      "Hemoglobin A2 (HbA2)",
      "Foetal Haemoglobin (HbF)",
      "Hemoglobin S (HbS)",
      "Hb A0 Level",
    ],
  },
  {
    code: "WIDAL_TUBE",
    name: "Widal Tube Test",
    category: "SEROLOGY_IMMUNOLOGY",
    price: 0,
    members: ["S.Typhi O", "S.Typhi H", "S.Paratyphi A(H)", "S.Paratyphi B(H)"],
  },
  {
    code: "DENGUE_ELISA",
    name: "Dengue Test (ELISA)",
    category: "SEROLOGY_IMMUNOLOGY",
    price: 550,
    members: ["Dengue Antigen (NS1)", "Dengue IgM Antibody", "Dengue IgG Antibody"],
  },
];

function parseRows(): CatalogRow[] {
  return CATALOG_LINES.split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [sourceCategory, name, unit, range, charge, formula] = line.split("|");
      return {
        sourceCategory: sourceCategory as SourceCategory,
        name: name.trim(),
        unit: (unit ?? "").trim(),
        range: (range ?? "").trim(),
        charge: Number(charge || 0),
        formula: (formula ?? "").trim(),
      };
    });
}

function toCode(name: string): string {
  let code = name
    .replace(/['+]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  if (/^[0-9]/.test(code)) code = `T_${code}`;
  if (code.length > 48) code = code.slice(0, 48).replace(/_+$/, "");
  return code || "TEST";
}

function parseRange(raw: string): ParsedRange[] {
  const s = raw.trim();
  if (!s) return [];
  if (s === "0") return [{ gender: null, low: 0, high: 0, textRange: "0" }];

  const mf = s.match(/^M:\s*([\d.]+)\s*-\s*([\d.]+)\s*\/\s*F:\s*([\d.]+)(?:\s*-\s*([\d.]+))?$/i);
  if (mf) {
    return [
      { gender: "MALE", low: Number(mf[1]), high: Number(mf[2]), textRange: null },
      {
        gender: "FEMALE",
        low: Number(mf[3]),
        high: mf[4] ? Number(mf[4]) : null,
        textRange: null,
      },
    ];
  }

  const maleOnly = s.match(/^M:\s*([\d.]+)\s*-\s*([\d.]+)$/i);
  if (maleOnly) {
    return [{ gender: "MALE", low: Number(maleOnly[1]), high: Number(maleOnly[2]), textRange: null }];
  }

  const to = s.match(/^(-?[\d.]+)\s+to\s+\+?(-?[\d.]+)$/i);
  if (to) return [{ gender: null, low: Number(to[1]), high: Number(to[2]), textRange: null }];

  const dash = s.match(/^([\d.]+)\s*-\s*([\d.]+)$/);
  if (dash) return [{ gender: null, low: Number(dash[1]), high: Number(dash[2]), textRange: null }];

  const dashUnit = s.match(/^([\d.]+)\s*-\s*([\d.]+)\s+\S+/);
  if (dashUnit) {
    return [{ gender: null, low: Number(dashUnit[1]), high: Number(dashUnit[2]), textRange: s }];
  }

  const ltParen = s.match(/^<\s*([\d.]+)\s*\(/);
  if (ltParen) return [{ gender: null, low: null, high: Number(ltParen[1]), textRange: s }];

  const lt = s.match(/^<\s*([\d.]+)$/);
  if (lt) return [{ gender: null, low: null, high: Number(lt[1]), textRange: null }];

  const gt = s.match(/^>\s*([\d.]+)$/);
  if (gt) return [{ gender: null, low: Number(gt[1]), high: null, textRange: null }];

  return [{ gender: null, low: null, high: null, textRange: s }];
}

function isQualitative(range: string, parsed: ParsedRange[]): boolean {
  if (!range) return false;
  if (parsed.some((p) => p.low != null || p.high != null)) return false;
  const lower = range.toLowerCase();
  if (QUALITATIVE_WORDS.has(lower)) return true;
  if (/^(negative|non-reactive|nil|not seen|not detected|no growth)/i.test(range)) return true;
  if (/^<\s*1:\d+/.test(range)) return true;
  return false;
}

function inferDataType(row: CatalogRow, parsed: ParsedRange[]): ResultDataType {
  if (/culture/i.test(row.name)) return "ORGANISM_PANEL";
  if (isQualitative(row.range, parsed)) return "QUALITATIVE";
  if (
    /impression|gross|clinical history|advice|advised|specimen identification|other parameters|method|grade|collection|abstinence|nature of specimen/i.test(
      row.name
    )
  ) {
    return "TEXT";
  }
  if (row.unit || parsed.some((p) => p.low != null || p.high != null)) return "NUMERIC";
  if (row.range) return "TEXT";
  return "TEXT";
}

function specimenFor(row: CatalogRow): string {
  if (/urine|microalbumin/i.test(row.name) && row.sourceCategory === "BIOCHEMISTRY") return "Urine";
  if (/pap smear/i.test(row.name)) return "Cervical smear";
  if (/blood culture/i.test(row.name)) return "Blood";
  if (/urine culture/i.test(row.name)) return "Urine";
  if (/pus culture/i.test(row.name)) return "Pus";
  if (/sputum/i.test(row.name)) return "Sputum";
  if (/acth/i.test(row.name)) return "EDTA Plasma";
  if (/pt\b|inr|aptt|prothrombin|bleeding time|clotting time/i.test(row.name)) return "Citrate Plasma";
  if (/esr|reticulocyte|peripheral smear|sickling|g6pd|blood group|mp by|ps for/i.test(row.name)) {
    return "Whole Blood EDTA";
  }
  return SPECIMEN_BY_CATEGORY[row.sourceCategory];
}

function decimalPrecision(row: CatalogRow, parsed: ParsedRange[]): number {
  if (/platelet|wbc|tlc|count|anc|alc|amc|aec|abc/i.test(row.name) && !/%/.test(row.unit)) return 0;
  const samples = parsed.flatMap((p) => [p.low, p.high]).filter((n): n is number => n != null);
  if (samples.length) {
    const places = Math.max(
      ...samples.map((n) => {
        const text = String(n);
        return text.includes(".") ? text.split(".")[1].length : 0;
      })
    );
    return Math.min(places, 3);
  }
  if (/ratio/i.test(row.name)) return 2;
  return 2;
}

function turnaroundHours(category: TestCategory): number {
  switch (category) {
    case "HEMATOLOGY":
    case "COAGULATION":
      return 4;
    case "CLINICAL_CHEMISTRY":
    case "URINALYSIS":
      return 6;
    case "MICROBIOLOGY":
      return 72;
    case "HISTOPATHOLOGY":
    case "CYTOLOGY":
      return 120;
    case "MOLECULAR":
      return 48;
    default:
      return 24;
  }
}

function formulaToExpr(formula: string, nameToCode: Map<string, string>): string | null {
  const refs = [...formula.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1].trim());
  if (refs.length === 0) return null;
  let expr = formula;
  for (const ref of refs.sort((a, b) => b.length - a.length)) {
    const code = nameToCode.get(ref);
    if (!code) return null;
    expr = expr.split(`[${ref}]`).join(code);
  }
  if (expr.includes("[")) return null;
  return `expr:${expr.replace(/\s+/g, " ").trim()}`;
}

export async function seedMasterCatalog(prisma: PrismaClient, vendorId: string) {
  const rows = parseRows().filter((row) => !SKIP_NAMES.has(row.name));
  const usedCodes = new Set<string>();
  const nameToCode = new Map<string, string>();
  const panelNames = new Set(PANEL_DEFS.map((panel) => panel.name.trim().toLowerCase()));
  const panelMemberNames = new Set(PANEL_DEFS.flatMap((panel) => panel.members.map((name) => name.trim().toLowerCase())));

  for (const row of rows) {
    let code = CODE_BY_NAME[row.name] ?? toCode(row.name);
    if (usedCodes.has(code) && nameToCode.get(row.name) !== code) {
      const suffix = `_${row.sourceCategory.replace(/\s+/g, "_").slice(0, 8)}`;
      code = `${code}${suffix}`.slice(0, 48);
    }
    usedCodes.add(code);
    nameToCode.set(row.name, code);
  }

  for (const [index, row] of rows.entries()) {
    const code = nameToCode.get(row.name)!;
    const category = CATEGORY_MAP[row.sourceCategory];
    const parsed = parseRange(row.range);
    const dataType = inferDataType(row, parsed);
    const namedRule = RULE_BY_NAME[row.name];
    const exprRule = row.formula ? formulaToExpr(row.formula, nameToCode) : null;
    const derivationRule = namedRule ?? exprRule ?? null;
    const isDerived = Boolean(derivationRule);
    const unit = row.unit || null;
    const price = row.charge;
    const hideOnBooking =
      isDerived ||
      panelNames.has(row.name.trim().toLowerCase()) ||
      (row.charge === 0 && panelMemberNames.has(row.name.trim().toLowerCase())) ||
      /:-\s*$/.test(row.name);

    await prisma.test.upsert({
      where: { vendorId_code: { vendorId, code } },
      update: {
        name: row.name,
        category,
        specimenType: specimenFor(row),
        unit,
        price,
        decimalPrecision: decimalPrecision(row, parsed),
        dataType,
        isDerived,
        derivationRule,
        sortOrder: index,
        hideOnBooking,
        turnaroundHours: turnaroundHours(category),
        autoVerifyEligible: dataType === "NUMERIC" && !isDerived,
        active: true,
      },
      create: {
        vendorId,
        code,
        name: row.name,
        category,
        specimenType: specimenFor(row),
        unit,
        price,
        decimalPrecision: decimalPrecision(row, parsed),
        dataType,
        isDerived,
        derivationRule,
        sortOrder: index,
        hideOnBooking,
        turnaroundHours: turnaroundHours(category),
        autoVerifyEligible: dataType === "NUMERIC" && !isDerived,
      },
    });

    const test = await prisma.test.findUniqueOrThrow({
      where: { vendorId_code: { vendorId, code } },
    });
    for (const range of parsed) {
      const existing = await prisma.referenceRange.findFirst({
        where: { testId: test.id, isDefault: true, gender: range.gender },
      });
      const data = {
        gender: range.gender,
        low: range.low,
        high: range.high,
        textRange: range.textRange,
        unit,
        isDefault: true,
        ageMinDays: 0,
        ageMaxDays: 43800,
      };
      if (existing) {
        await prisma.referenceRange.update({ where: { id: existing.id }, data });
      } else {
        await prisma.referenceRange.create({ data: { testId: test.id, ...data } });
      }
    }
  }

  for (const panelDef of PANEL_DEFS) {
    const panel = await prisma.panel.upsert({
      where: { vendorId_code: { vendorId, code: panelDef.code } },
      update: {
        name: panelDef.name,
        category: panelDef.category,
        price: panelDef.price,
        active: true,
      },
      create: {
        vendorId,
        code: panelDef.code,
        name: panelDef.name,
        category: panelDef.category,
        price: panelDef.price,
      },
    });

    for (const [index, memberName] of panelDef.members.entries()) {
      const code = nameToCode.get(memberName);
      if (!code) {
        console.warn(`Panel ${panelDef.code}: missing test "${memberName}"`);
        continue;
      }
      const test = await prisma.test.findUnique({
        where: { vendorId_code: { vendorId, code } },
      });
      if (!test) {
        console.warn(`Panel ${panelDef.code}: test code ${code} not found`);
        continue;
      }
      await prisma.panelTest.upsert({
        where: { panelId_testId: { panelId: panel.id, testId: test.id } },
        update: { sortOrder: index },
        create: { panelId: panel.id, testId: test.id, sortOrder: index },
      });
    }
  }

  const extraPanelMembers: Array<{ panelCode: string; testCode: string }> = [
    { panelCode: "KFT", testCode: "EGFR" },
    { panelCode: "KFT", testCode: "CORR_CALCIUM" },
    { panelCode: "LFT", testCode: "DE_RITIS" },
    { panelCode: "LIPID", testCode: "NON_HDL" },
  ];
  for (const extra of extraPanelMembers) {
    const panel = await prisma.panel.findUnique({
      where: { vendorId_code: { vendorId, code: extra.panelCode } },
    });
    const test = await prisma.test.findUnique({
      where: { vendorId_code: { vendorId, code: extra.testCode } },
    });
    if (!panel || !test) continue;
    const last = await prisma.panelTest.findFirst({
      where: { panelId: panel.id },
      orderBy: { sortOrder: "desc" },
    });
    await prisma.panelTest.upsert({
      where: { panelId_testId: { panelId: panel.id, testId: test.id } },
      update: {},
      create: { panelId: panel.id, testId: test.id, sortOrder: (last?.sortOrder ?? 0) + 1 },
    });
  }

  console.log(`Master catalog: ${rows.length} tests, ${PANEL_DEFS.length} panels.`);
}
