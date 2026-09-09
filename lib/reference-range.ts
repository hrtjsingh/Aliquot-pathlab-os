import { ReferenceRange, Gender } from "@prisma/client";

export type PatientForRange = {
  gender: Gender;
  ageDays: number;
  isPregnant?: boolean;
  pregnancyTrimester?: number | null;
};

/**
 * Resolution order (documented per spec — reference ranges vary by age,
 * gender, specimen type, and sometimes pregnancy trimester; there must
 * always be a documented fallback):
 *   1. Exact match: gender + age band + pregnancy trimester
 *   2. Gender + age band (non-pregnancy-specific)
 *   3. Age band only (gender = null, i.e. applies to all genders)
 *   4. Row flagged isDefault=true for this test (adult catch-all)
 * Returns null only if the test has no reference ranges configured at all.
 */
export function resolveReferenceRange(
  ranges: ReferenceRange[],
  patient: PatientForRange
): ReferenceRange | null {
  if (ranges.length === 0) return null;

  const ageMatches = (r: ReferenceRange) => patient.ageDays >= r.ageMinDays && patient.ageDays <= r.ageMaxDays;

  if (patient.isPregnant) {
    const exact = ranges.find(
      (r) => r.pregnancyOnly && r.gender === patient.gender && ageMatches(r) && r.trimester === patient.pregnancyTrimester
    );
    if (exact) return exact;

    const anyTrimester = ranges.find((r) => r.pregnancyOnly && r.gender === patient.gender && ageMatches(r));
    if (anyTrimester) return anyTrimester;
  }

  const genderAge = ranges.find((r) => !r.pregnancyOnly && r.gender === patient.gender && ageMatches(r));
  if (genderAge) return genderAge;

  const ageOnly = ranges.find((r) => !r.pregnancyOnly && r.gender === null && ageMatches(r));
  if (ageOnly) return ageOnly;

  const fallback = ranges.find((r) => r.isDefault);
  return fallback ?? null;
}

export function formatRangeText(r: ReferenceRange | null): string {
  if (!r) return "Not established";
  if (r.textRange) return r.textRange;
  if (r.low != null && r.high != null) return `${r.low} - ${r.high}`;
  if (r.low != null) return `> ${r.low}`;
  if (r.high != null) return `< ${r.high}`;
  return "Not established";
}

export function convertUnit(value: number, factor: number | null | undefined): number | null {
  if (factor == null) return null;
  return value * factor;
}

export function ageInDays(dob: Date | null, ageYearsFallback: number | null, ageMonthsFallback?: number | null): number {
  if (dob) {
    const ms = Date.now() - dob.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }
  if (ageMonthsFallback) return Math.round(ageMonthsFallback * 30.44);
  if (ageYearsFallback) return Math.round(ageYearsFallback * 365.25);
  return 365.25 * 30; // default to 30y adult if truly unknown, so lookup doesn't crash
}
