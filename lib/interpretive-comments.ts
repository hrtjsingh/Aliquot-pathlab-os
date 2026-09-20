/**
 * Auto-populated interpretive comments for common result patterns.
 * These are suggestions only — always pathologist-editable/overridable
 * before report release (see Result.pathologistNote).
 */

type ResultLookup = Record<string, number | null | undefined>; // testCode -> numericValue

type Rule = {
  id: string;
  appliesTo: string[]; // test codes this rule reads
  test: (r: ResultLookup, ranges: Record<string, { low?: number | null; high?: number | null }>) => boolean;
  comment: string;
};

const RULES: Rule[] = [
  {
    id: "microcytic-hypochromic",
    appliesTo: ["MCV", "MCH"],
    test: (r, ranges) =>
      r.MCV != null && r.MCH != null && ranges.MCV?.low != null && ranges.MCH?.low != null &&
      r.MCV < ranges.MCV.low && r.MCH < ranges.MCH.low,
    comment: "Findings are suggestive of microcytic hypochromic anemia. Correlate clinically; consider iron studies.",
  },
  {
    id: "macrocytic",
    appliesTo: ["MCV"],
    test: (r, ranges) => r.MCV != null && ranges.MCV?.high != null && r.MCV > ranges.MCV.high,
    comment: "Macrocytosis noted. Consider B12/folate deficiency, liver disease, or hypothyroidism as clinically indicated.",
  },
  {
    id: "leukocytosis-neutrophilic",
    appliesTo: ["TLC", "ANC"],
    test: (r, ranges) => r.TLC != null && ranges.TLC?.high != null && r.TLC > ranges.TLC.high,
    comment: "Leukocytosis noted; correlate with clinical picture for infection/inflammation.",
  },
  {
    id: "thrombocytopenia",
    appliesTo: ["PLATELET"],
    test: (r, ranges) => r.PLATELET != null && ranges.PLATELET?.low != null && r.PLATELET < ranges.PLATELET.low,
    comment: "Thrombocytopenia noted. Recommend peripheral smear review to exclude clumping artifact.",
  },
  {
    id: "elevated-de-ritis",
    appliesTo: ["DE_RITIS"],
    test: (r) => r.DE_RITIS != null && r.DE_RITIS > 2,
    comment: "AST/ALT ratio > 2 may suggest alcoholic liver injury; clinical correlation advised.",
  },
  {
    id: "reduced-egfr",
    appliesTo: ["EGFR"],
    test: (r) => r.EGFR != null && r.EGFR < 60,
    comment: "eGFR < 60 mL/min/1.73m² — consistent with reduced renal function; repeat testing in 3 months recommended if not previously documented (KDIGO criteria).",
  },
];

export function generateInterpretiveComments(
  results: ResultLookup,
  ranges: Record<string, { low?: number | null; high?: number | null }>
): { ruleId: string; comment: string }[] {
  return RULES.filter((rule) => rule.appliesTo.every((code) => code in results) && rule.test(results, ranges)).map(
    (rule) => ({ ruleId: rule.id, comment: rule.comment })
  );
}
