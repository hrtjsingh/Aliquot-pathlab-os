export type TestProfileDefaults = {
  description: string;
  method?: string;
  collectionNotes?: string;
};

/** Clinical copy used when a test has no saved profile text. */
export const TEST_PROFILE_DEFAULTS: Record<string, TestProfileDefaults> = {
  HB: {
    description: "Hemoglobin concentration in whole blood. Used to screen and monitor anemia and polycythemia.",
    method: "Automated CBC, colorimetric",
    collectionNotes: "EDTA whole blood. Mix immediately. Do not freeze.",
  },
  RBC: {
    description: "Red blood cell count. Interpreted with hemoglobin, hematocrit, and red cell indices.",
    method: "Automated CBC, impedance or optical",
    collectionNotes: "EDTA whole blood.",
  },
  HCT: {
    description: "Packed cell volume. Complements hemoglobin for anemia workup.",
    method: "Automated CBC, calculated or measured",
    collectionNotes: "EDTA whole blood.",
  },
  TLC: {
    description: "Total leukocyte count. Elevated in infection or inflammation; low in marrow suppression.",
    method: "Automated CBC",
    collectionNotes: "EDTA whole blood. Analyze within 6 hours.",
  },
  NEUT_PCT: {
    description: "Neutrophil percentage of circulating leukocytes. Used with ANC in infection workup.",
    method: "Automated differential",
    collectionNotes: "EDTA whole blood.",
  },
  LYMPH_PCT: {
    description: "Lymphocyte percentage of circulating leukocytes.",
    method: "Automated differential",
    collectionNotes: "EDTA whole blood.",
  },
  PLATELET: {
    description: "Platelet count for bleeding risk, thrombocytopenia, and thrombocytosis.",
    method: "Automated CBC, impedance or optical",
    collectionNotes: "EDTA whole blood. Recollect if clumped.",
  },
  MCV: { description: "Mean corpuscular volume. Classifies anemia as micro, normo, or macrocytic.", method: "Calculated from CBC" },
  MCH: { description: "Mean corpuscular hemoglobin. Average hemoglobin per red cell.", method: "Calculated from CBC" },
  MCHC: { description: "Mean corpuscular hemoglobin concentration. Low in hypochromic anemias.", method: "Calculated from CBC" },
  ANC: { description: "Absolute neutrophil count. Critical for neutropenia and chemotherapy monitoring.", method: "Calculated from TLC and neutrophil %" },
  ALC: { description: "Absolute lymphocyte count. Used in viral illness and immunodeficiency workup.", method: "Calculated from TLC and lymphocyte %" },
  AST: {
    description: "Aspartate aminotransferase. Rises in hepatocellular injury and some muscle injury.",
    method: "IFCC kinetic, 37°C",
    collectionNotes: "Serum. Avoid hemolysis.",
  },
  ALT: {
    description: "Alanine aminotransferase. More liver-specific than AST.",
    method: "IFCC kinetic, 37°C",
    collectionNotes: "Serum. Avoid hemolysis.",
  },
  ALBUMIN: {
    description: "Major plasma protein. Low in liver disease, malnutrition, and inflammation.",
    method: "Bromocresol green or purple",
    collectionNotes: "Serum.",
  },
  TOTAL_PROTEIN: {
    description: "Total serum protein. Used with albumin to derive globulin and A/G ratio.",
    method: "Biuret",
    collectionNotes: "Serum.",
  },
  CREATININE: {
    description: "Marker of glomerular filtration. Used to calculate eGFR.",
    method: "Enzymatic or Jaffe",
    collectionNotes: "Serum. Note muscle mass and recent meat intake.",
  },
  BUN: {
    description: "Blood urea nitrogen. Rises in reduced GFR, GI bleed, and high protein load.",
    method: "Urease",
    collectionNotes: "Serum.",
  },
  CALCIUM: {
    description: "Total calcium. Interpret with albumin; consider corrected calcium when albumin is low.",
    method: "Arsenazo or ISE",
    collectionNotes: "Serum. Avoid prolonged tourniquet time.",
  },
  SODIUM: {
    description: "Major extracellular cation. Critical for hyponatremia and hypernatremia.",
    method: "Ion-selective electrode",
    collectionNotes: "Serum. Mark if drawn from a drip arm.",
  },
  CHLORIDE: {
    description: "Major extracellular anion. Used with sodium and bicarbonate for anion gap.",
    method: "Ion-selective electrode",
    collectionNotes: "Serum.",
  },
  BICARBONATE: {
    description: "Total CO2 / bicarbonate. Reflects acid-base status.",
    method: "Enzymatic or ISE",
    collectionNotes: "Serum. Keep capped until analysis.",
  },
  GLUCOSE: {
    description: "Fasting plasma glucose for diabetes screening and monitoring.",
    method: "Hexokinase or glucose oxidase",
    collectionNotes: "Serum or fluoride tube. Patient should be fasting 8 hours unless STAT.",
  },
  TOTAL_CHOLESTEROL: {
    description: "Total cholesterol as part of cardiovascular risk assessment.",
    method: "Enzymatic, cholesterol oxidase",
    collectionNotes: "Serum. Fasting preferred with a lipid profile.",
  },
  HDL: {
    description: "HDL cholesterol. Higher values are generally protective.",
    method: "Direct homogeneous or precipitation",
    collectionNotes: "Serum.",
  },
  TRIGLYCERIDES: {
    description: "Triglycerides. Markedly high values raise pancreatitis risk and invalidate Friedewald LDL.",
    method: "Enzymatic, glycerol kinase",
    collectionNotes: "Serum. 9–12 hour fast preferred.",
  },
  EGFR: { description: "Estimated GFR by CKD-EPI 2021 from creatinine, age, and sex.", method: "Calculated" },
  BUN_CR_RATIO: { description: "BUN to creatinine ratio. Helps separate pre-renal from intrinsic renal azotemia.", method: "Calculated" },
  CORR_CALCIUM: { description: "Calcium corrected for albumin. Use when albumin is abnormal.", method: "Calculated" },
  LDL: { description: "LDL cholesterol by Friedewald. Not valid if triglycerides exceed 400 mg/dL.", method: "Calculated" },
  NON_HDL: { description: "Non-HDL cholesterol (total minus HDL). Residual cardiovascular risk marker.", method: "Calculated" },
  TC_HDL_RATIO: { description: "Total cholesterol to HDL ratio. Used in cardiovascular risk scoring.", method: "Calculated" },
  DE_RITIS: { description: "AST/ALT ratio. A high ratio can suggest alcohol-related or advanced liver disease.", method: "Calculated" },
  AG_RATIO: { description: "Albumin/globulin ratio. Low in chronic inflammation and some liver disease.", method: "Calculated" },
  ANION_GAP: { description: "Na − (Cl + HCO3). High gap suggests metabolic acidosis.", method: "Calculated" },
  CORR_SODIUM: { description: "Sodium corrected for marked hyperglycemia.", method: "Calculated" },
};

export type TestProfile = {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  category: string;
  specimenType: string;
  method: string | null;
  loincCode: string | null;
  unit: string | null;
  turnaroundHours: number | null;
  description: string | null;
  collectionNotes: string | null;
  dataType: string;
  isDerived: boolean;
  autoVerifyEligible: boolean;
  referenceRanges: Array<{
    id: string;
    gender: string | null;
    ageMinDays: number;
    ageMaxDays: number;
    low: number | null;
    high: number | null;
    isDefault: boolean;
  }>;
  criticalThresholds: Array<{
    id: string;
    low: number | null;
    high: number | null;
    gender: string | null;
  }>;
  panels: Array<{ code: string; name: string }>;
};

export function resolveProfileText(code: string, stored: { description?: string | null; method?: string | null; collectionNotes?: string | null }) {
  const fallback = TEST_PROFILE_DEFAULTS[code];
  return {
    description: stored.description?.trim() || fallback?.description || null,
    method: stored.method?.trim() || fallback?.method || null,
    collectionNotes: stored.collectionNotes?.trim() || fallback?.collectionNotes || null,
  };
}

export function formatAgeBand(ageMinDays: number, ageMaxDays: number) {
  const minYears = Math.round(ageMinDays / 365.25);
  const maxYears = Math.round(ageMaxDays / 365.25);
  if (ageMinDays <= 0 && ageMaxDays >= 40000) return "All ages";
  if (ageMinDays >= 6500 && ageMaxDays >= 40000) return `Adult (${minYears}y+)`;
  if (ageMaxDays < 365) return `0–${ageMaxDays} days`;
  return `${minYears}–${maxYears} y`;
}

export function formatNumericRange(low: number | null, high: number | null) {
  if (low != null && high != null) return `${low} – ${high}`;
  if (low != null) return `≥ ${low}`;
  if (high != null) return `≤ ${high}`;
  return "—";
}
