/**
 * Derived-value calculation engine.
 *
 * Design intent (per spec): formulas like eGFR constants or coagulation ISI
 * change with guideline updates / reagent lots, and labs add new derived
 * parameters often. So this is NOT a switch-statement of hardcoded formulas —
 * each rule is a registered, independently testable function that declares
 * its own inputs, and constants that are genuinely lab/reagent-configurable
 * (ISI, eGFR race-free constants) are passed in as config rather than baked
 * into the formula body.
 *
 * A Test row with isDerived=true stores a `derivationRule` key that must
 * match a key in CALC_RULES below. Wire a new derived test by (1) adding the
 * Test row with that key and (2) registering the rule here — no other code
 * changes needed.
 */

export type PatientContext = {
  gender: "MALE" | "FEMALE" | "OTHER";
  ageYears: number;
};

export type CalcInputs = Record<string, number | null | undefined>;

export type CalcRuleResult = {
  value: number | null;
  suppressed?: boolean; // true when a precondition fails (e.g. TG >= 400 for Friedewald LDL)
  suppressReason?: string;
};

export type CalcRule = {
  key: string;
  label: string;
  /** test codes this rule reads from the same order, in the order documented */
  inputs: string[];
  outputUnit: string;
  compute: (inputs: CalcInputs, ctx: PatientContext, config?: Record<string, number>) => CalcRuleResult;
};

function allPresent(inputs: CalcInputs, keys: string[]): boolean {
  return keys.every((k) => inputs[k] !== null && inputs[k] !== undefined && !Number.isNaN(inputs[k]));
}

export const CALC_RULES: Record<string, CalcRule> = {
  // ---------------------------------------------------------------- Hematology
  MCV: {
    key: "MCV",
    label: "Mean Corpuscular Volume",
    inputs: ["HCT", "RBC"],
    outputUnit: "fL",
    compute: (i) => {
      if (!allPresent(i, ["HCT", "RBC"]) || i.RBC === 0) return { value: null, suppressed: true };
      return { value: (i.HCT! * 10) / i.RBC! };
    },
  },
  MCH: {
    key: "MCH",
    label: "Mean Corpuscular Hemoglobin",
    inputs: ["HB", "RBC"],
    outputUnit: "pg",
    compute: (i) => {
      if (!allPresent(i, ["HB", "RBC"]) || i.RBC === 0) return { value: null, suppressed: true };
      return { value: (i.HB! * 10) / i.RBC! };
    },
  },
  MCHC: {
    key: "MCHC",
    label: "Mean Corpuscular Hemoglobin Concentration",
    inputs: ["HB", "HCT"],
    outputUnit: "g/dL",
    compute: (i) => {
      if (!allPresent(i, ["HB", "HCT"]) || i.HCT === 0) return { value: null, suppressed: true };
      return { value: (i.HB! * 100) / i.HCT! };
    },
  },
  ANC: {
    key: "ANC",
    label: "Absolute Neutrophil Count",
    inputs: ["TLC", "NEUT_PCT"],
    outputUnit: "/uL",
    compute: (i) => {
      if (!allPresent(i, ["TLC", "NEUT_PCT"])) return { value: null, suppressed: true };
      return { value: i.TLC! * (i.NEUT_PCT! / 100) };
    },
  },
  ALC: {
    key: "ALC",
    label: "Absolute Lymphocyte Count",
    inputs: ["TLC", "LYMPH_PCT"],
    outputUnit: "/uL",
    compute: (i) => {
      if (!allPresent(i, ["TLC", "LYMPH_PCT"])) return { value: null, suppressed: true };
      return { value: i.TLC! * (i.LYMPH_PCT! / 100) };
    },
  },

  // ------------------------------------------------------------ Renal function
  // CKD-EPI 2021 race-free equation. Constants (kappa, alpha, per-sex
  // multipliers) are lab-configurable via `config` since guideline bodies
  // periodically revise them; sane 2021 defaults are provided as fallback.
  EGFR_CKD_EPI_2021: {
    key: "EGFR_CKD_EPI_2021",
    label: "eGFR (CKD-EPI 2021, race-free)",
    inputs: ["CREATININE"],
    outputUnit: "mL/min/1.73m2",
    compute: (i, ctx, config) => {
      if (!allPresent(i, ["CREATININE"]) || !ctx.ageYears) return { value: null, suppressed: true };
      const scr = i.CREATININE!;
      const isFemale = ctx.gender === "FEMALE";
      const kappa = isFemale ? (config?.kappaFemale ?? 0.7) : (config?.kappaMale ?? 0.9);
      const alpha = isFemale ? (config?.alphaFemale ?? -0.241) : (config?.alphaMale ?? -0.302);
      const sexMultiplier = isFemale ? (config?.sexMultiplier ?? 1.012) : 1;
      const ratio = scr / kappa;
      const minTerm = Math.pow(Math.min(ratio, 1), alpha);
      const maxTerm = Math.pow(Math.max(ratio, 1), -1.2);
      const ageTerm = Math.pow(0.9938, ctx.ageYears);
      const value = 142 * minTerm * maxTerm * ageTerm * sexMultiplier;
      return { value: Math.round(value * 10) / 10 };
    },
  },
  BUN_CREATININE_RATIO: {
    key: "BUN_CREATININE_RATIO",
    label: "BUN/Creatinine Ratio",
    inputs: ["BUN", "CREATININE"],
    outputUnit: "",
    compute: (i) => {
      if (!allPresent(i, ["BUN", "CREATININE"]) || i.CREATININE === 0) return { value: null, suppressed: true };
      return { value: i.BUN! / i.CREATININE! };
    },
  },
  CORRECTED_CALCIUM: {
    key: "CORRECTED_CALCIUM",
    label: "Corrected Calcium",
    inputs: ["CALCIUM", "ALBUMIN"],
    outputUnit: "mg/dL",
    compute: (i) => {
      if (!allPresent(i, ["CALCIUM", "ALBUMIN"])) return { value: null, suppressed: true };
      return { value: i.CALCIUM! + 0.8 * (4.0 - i.ALBUMIN!) };
    },
  },

  // ------------------------------------------------------------------- Lipids
  LDL_FRIEDEWALD: {
    key: "LDL_FRIEDEWALD",
    label: "LDL Cholesterol (Friedewald)",
    inputs: ["TOTAL_CHOLESTEROL", "HDL", "TRIGLYCERIDES"],
    outputUnit: "mg/dL",
    compute: (i) => {
      if (!allPresent(i, ["TOTAL_CHOLESTEROL", "HDL", "TRIGLYCERIDES"])) return { value: null, suppressed: true };
      if (i.TRIGLYCERIDES! >= 400) {
        return { value: null, suppressed: true, suppressReason: "TG >= 400 mg/dL — Friedewald formula invalid; direct LDL measurement required" };
      }
      return { value: i.TOTAL_CHOLESTEROL! - i.HDL! - i.TRIGLYCERIDES! / 5 };
    },
  },
  NON_HDL_CHOLESTEROL: {
    key: "NON_HDL_CHOLESTEROL",
    label: "Non-HDL Cholesterol",
    inputs: ["TOTAL_CHOLESTEROL", "HDL"],
    outputUnit: "mg/dL",
    compute: (i) => {
      if (!allPresent(i, ["TOTAL_CHOLESTEROL", "HDL"])) return { value: null, suppressed: true };
      return { value: i.TOTAL_CHOLESTEROL! - i.HDL! };
    },
  },
  TC_HDL_RATIO: {
    key: "TC_HDL_RATIO",
    label: "TC/HDL Ratio",
    inputs: ["TOTAL_CHOLESTEROL", "HDL"],
    outputUnit: "",
    compute: (i) => {
      if (!allPresent(i, ["TOTAL_CHOLESTEROL", "HDL"]) || i.HDL === 0) return { value: null, suppressed: true };
      return { value: i.TOTAL_CHOLESTEROL! / i.HDL! };
    },
  },

  // -------------------------------------------------------------------- Liver
  DE_RITIS_RATIO: {
    key: "DE_RITIS_RATIO",
    label: "AST/ALT Ratio (De Ritis)",
    inputs: ["AST", "ALT"],
    outputUnit: "",
    compute: (i) => {
      if (!allPresent(i, ["AST", "ALT"]) || i.ALT === 0) return { value: null, suppressed: true };
      return { value: i.AST! / i.ALT! };
    },
  },
  AG_RATIO: {
    key: "AG_RATIO",
    label: "Albumin/Globulin Ratio",
    inputs: ["ALBUMIN", "TOTAL_PROTEIN"],
    outputUnit: "",
    compute: (i) => {
      if (!allPresent(i, ["ALBUMIN", "TOTAL_PROTEIN"])) return { value: null, suppressed: true };
      const globulin = i.TOTAL_PROTEIN! - i.ALBUMIN!;
      if (globulin === 0) return { value: null, suppressed: true };
      return { value: i.ALBUMIN! / globulin };
    },
  },

  // --------------------------------------------------------------- Electrolytes
  ANION_GAP: {
    key: "ANION_GAP",
    label: "Anion Gap",
    inputs: ["SODIUM", "CHLORIDE", "BICARBONATE"],
    outputUnit: "mEq/L",
    compute: (i) => {
      if (!allPresent(i, ["SODIUM", "CHLORIDE", "BICARBONATE"])) return { value: null, suppressed: true };
      return { value: i.SODIUM! - (i.CHLORIDE! + i.BICARBONATE!) };
    },
  },
  CORRECTED_SODIUM: {
    key: "CORRECTED_SODIUM",
    label: "Corrected Sodium (hyperglycemia)",
    inputs: ["SODIUM", "GLUCOSE"],
    outputUnit: "mEq/L",
    compute: (i) => {
      if (!allPresent(i, ["SODIUM", "GLUCOSE"])) return { value: null, suppressed: true };
      return { value: i.SODIUM! + 1.6 * ((i.GLUCOSE! - 100) / 100) };
    },
  },

  // ------------------------------------------------------------------ Coagulation
  // ISI is reagent/lot specific — must be supplied via config, never hardcoded.
  INR: {
    key: "INR",
    label: "INR",
    inputs: ["PATIENT_PT", "MEAN_NORMAL_PT"],
    outputUnit: "",
    compute: (i, _ctx, config) => {
      if (!allPresent(i, ["PATIENT_PT", "MEAN_NORMAL_PT"])) return { value: null, suppressed: true };
      const isi = config?.isi;
      if (!isi) return { value: null, suppressed: true, suppressReason: "ISI not configured for current reagent lot" };
      return { value: Math.pow(i.PATIENT_PT! / i.MEAN_NORMAL_PT!, isi) };
    },
  },

  // ------------------------------------------------------------------- Endocrine
  HOMA_IR: {
    key: "HOMA_IR",
    label: "HOMA-IR",
    inputs: ["FASTING_GLUCOSE", "FASTING_INSULIN"],
    outputUnit: "",
    compute: (i) => {
      if (!allPresent(i, ["FASTING_GLUCOSE", "FASTING_INSULIN"])) return { value: null, suppressed: true };
      return { value: (i.FASTING_GLUCOSE! * i.FASTING_INSULIN!) / 405 };
    },
  },
  FREE_ANDROGEN_INDEX: {
    key: "FREE_ANDROGEN_INDEX",
    label: "Free Androgen Index",
    inputs: ["TOTAL_TESTOSTERONE", "SHBG"],
    outputUnit: "",
    compute: (i) => {
      if (!allPresent(i, ["TOTAL_TESTOSTERONE", "SHBG"]) || i.SHBG === 0) return { value: null, suppressed: true };
      return { value: (i.TOTAL_TESTOSTERONE! / i.SHBG!) * 100 };
    },
  },

  EAG_FROM_HBA1C: {
    key: "EAG_FROM_HBA1C",
    label: "Estimated Average Glucose",
    inputs: ["HBA1C"],
    outputUnit: "mg/dL",
    compute: (i) => {
      if (!allPresent(i, ["HBA1C"])) return { value: null, suppressed: true };
      return { value: i.HBA1C! * 28.7 - 46.7 };
    },
  },
  BUN_FROM_UREA: {
    key: "BUN_FROM_UREA",
    label: "BUN from Blood Urea",
    inputs: ["UREA"],
    outputUnit: "mg/dL",
    compute: (i) => {
      if (!allPresent(i, ["UREA"])) return { value: null, suppressed: true };
      return { value: i.UREA! * 0.467 };
    },
  },
  VLDL_FROM_TG: {
    key: "VLDL_FROM_TG",
    label: "VLDL Cholesterol",
    inputs: ["TRIGLYCERIDES"],
    outputUnit: "mg/dL",
    compute: (i) => {
      if (!allPresent(i, ["TRIGLYCERIDES"])) return { value: null, suppressed: true };
      return { value: i.TRIGLYCERIDES! / 5 };
    },
  },
  LDL_HDL_RATIO: {
    key: "LDL_HDL_RATIO",
    label: "LDL/HDL Ratio",
    inputs: ["LDL", "HDL"],
    outputUnit: "",
    compute: (i) => {
      if (!allPresent(i, ["LDL", "HDL"]) || i.HDL === 0) return { value: null, suppressed: true };
      return { value: i.LDL! / i.HDL! };
    },
  },
  GLOBULIN_FROM_PROTEIN: {
    key: "GLOBULIN_FROM_PROTEIN",
    label: "Serum Globulin",
    inputs: ["TOTAL_PROTEIN", "ALBUMIN"],
    outputUnit: "g/dL",
    compute: (i) => {
      if (!allPresent(i, ["TOTAL_PROTEIN", "ALBUMIN"])) return { value: null, suppressed: true };
      return { value: i.TOTAL_PROTEIN! - i.ALBUMIN! };
    },
  },
  INDIRECT_BILIRUBIN: {
    key: "INDIRECT_BILIRUBIN",
    label: "Indirect Bilirubin",
    inputs: ["TBIL", "DBIL"],
    outputUnit: "mg/dL",
    compute: (i) => {
      if (!allPresent(i, ["TBIL", "DBIL"])) return { value: null, suppressed: true };
      return { value: i.TBIL! - i.DBIL! };
    },
  },
  AMC: {
    key: "AMC",
    label: "Absolute Monocyte Count",
    inputs: ["TLC", "MONO_PCT"],
    outputUnit: "/uL",
    compute: (i) => {
      if (!allPresent(i, ["TLC", "MONO_PCT"])) return { value: null, suppressed: true };
      return { value: i.TLC! * (i.MONO_PCT! / 100) };
    },
  },
  AEC: {
    key: "AEC",
    label: "Absolute Eosinophil Count",
    inputs: ["TLC", "EOS_PCT"],
    outputUnit: "/uL",
    compute: (i) => {
      if (!allPresent(i, ["TLC", "EOS_PCT"])) return { value: null, suppressed: true };
      return { value: i.TLC! * (i.EOS_PCT! / 100) };
    },
  },
  ABC: {
    key: "ABC",
    label: "Absolute Basophil Count",
    inputs: ["TLC", "BASO_PCT"],
    outputUnit: "/uL",
    compute: (i) => {
      if (!allPresent(i, ["TLC", "BASO_PCT"])) return { value: null, suppressed: true };
      return { value: i.TLC! * (i.BASO_PCT! / 100) };
    },
  },
};

function evalArithmetic(expression: string, inputs: CalcInputs): CalcRuleResult {
  const ids = [...expression.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)].map((match) => match[0]);
  const unique = [...new Set(ids)];
  for (const id of unique) {
    const value = inputs[id];
    if (value == null || Number.isNaN(value)) return { value: null, suppressed: true };
  }
  let built = expression;
  for (const id of unique.sort((a, b) => b.length - a.length)) {
    built = built.replace(new RegExp(`\\b${id}\\b`, "g"), `(${inputs[id]})`);
  }
  if (!/^[\d.eE+\-*/()\s]+$/.test(built)) {
    throw new Error(`Unsafe derivation expression: ${expression}`);
  }
  try {
    const value = Function(`"use strict"; return (${built});`)() as number;
    if (typeof value !== "number" || !Number.isFinite(value)) return { value: null, suppressed: true };
    return { value };
  } catch {
    return { value: null, suppressed: true };
  }
}

/** Convenience: run a rule by key, throwing on unknown keys (a config error, not a runtime one). */
export function runCalcRule(
  ruleKey: string,
  inputs: CalcInputs,
  ctx: PatientContext,
  config?: Record<string, number>
): CalcRuleResult {
  if (ruleKey.startsWith("expr:")) return evalArithmetic(ruleKey.slice(5).trim(), inputs);
  const rule = CALC_RULES[ruleKey];
  if (!rule) throw new Error(`Unknown derivation rule: ${ruleKey}. Register it in lib/calc-engine.ts.`);
  return rule.compute(inputs, ctx, config);
}

export function derivationInputCodes(ruleKey: string | null | undefined): string[] {
  if (!ruleKey) return [];
  if (ruleKey.startsWith("expr:")) {
    const ids = [...ruleKey.slice(5).matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)].map((match) => match[0]);
    return [...new Set(ids)];
  }
  return CALC_RULES[ruleKey]?.inputs ?? [];
}
