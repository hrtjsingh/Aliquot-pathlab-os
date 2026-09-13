import { ResultFlag, CriticalThreshold, ReferenceRange } from "@prisma/client";

export type FlagInput = {
  numericValue: number | null;
  range: ReferenceRange | null;
  criticalThreshold: CriticalThreshold | null;
};

/**
 * Every result gets exactly one flag. Critical takes priority over plain H/L
 * because it drives a different workflow (call-back required), not just a
 * visual marker.
 */
export function computeFlag({ numericValue, range, criticalThreshold }: FlagInput): ResultFlag {
  if (numericValue == null) return ResultFlag.NORMAL;

  if (criticalThreshold) {
    if (criticalThreshold.low != null && numericValue < criticalThreshold.low) return ResultFlag.CRITICAL_LOW;
    if (criticalThreshold.high != null && numericValue > criticalThreshold.high) return ResultFlag.CRITICAL_HIGH;
  }

  if (range) {
    if (range.low != null && numericValue < range.low) return ResultFlag.LOW;
    if (range.high != null && numericValue > range.high) return ResultFlag.HIGH;
  }

  return ResultFlag.NORMAL;
}

export function parseRangeBounds(rangeText: string | null | undefined): { low: number | null; high: number | null } {
  const raw = (rangeText ?? "").trim();
  if (!raw) return { low: null, high: null };
  const dash = raw.match(/^([\d.]+)\s*[-–—to]+\s*([\d.]+)/i);
  if (dash) return { low: Number(dash[1]), high: Number(dash[2]) };
  const lt = raw.match(/^[<≤]\s*([\d.]+)/);
  if (lt) return { low: null, high: Number(lt[1]) };
  const gt = raw.match(/^[>≥]\s*([\d.]+)/);
  if (gt) return { low: Number(gt[1]), high: null };
  return { low: null, high: null };
}

export function previewFlag(numericValue: number | null, rangeText: string | null | undefined): ResultFlag {
  if (numericValue == null || Number.isNaN(numericValue)) return ResultFlag.NORMAL;
  const { low, high } = parseRangeBounds(rangeText);
  if (low != null && numericValue < low) return ResultFlag.LOW;
  if (high != null && numericValue > high) return ResultFlag.HIGH;
  return ResultFlag.NORMAL;
}

export function requiresCriticalCallback(flag: ResultFlag): boolean {
  return flag === ResultFlag.CRITICAL_LOW || flag === ResultFlag.CRITICAL_HIGH;
}

export type DeltaCheckConfig = {
  /** flag if |change| exceeds this percent of the previous value */
  pctThreshold?: number;
  /** flag if |change| exceeds this absolute amount, regardless of percent */
  absThreshold?: number;
};

export type DeltaResult = {
  flagged: boolean;
  pctChange: number | null;
};

/**
 * Delta check compares the current result to the patient's most recent prior
 * result for the same test — catches sample mix-ups and transcription errors
 * that fall inside the normal reference range and so wouldn't otherwise flag.
 */
export function computeDelta(current: number, previous: number | null, config: DeltaCheckConfig): DeltaResult {
  if (previous == null) return { flagged: false, pctChange: null };
  const absChange = Math.abs(current - previous);
  const pctChange = previous !== 0 ? (absChange / Math.abs(previous)) * 100 : null;

  const pctExceeded = config.pctThreshold != null && pctChange != null && pctChange > config.pctThreshold;
  const absExceeded = config.absThreshold != null && absChange > config.absThreshold;

  return { flagged: Boolean(pctExceeded || absExceeded), pctChange };
}

/**
 * Auto-verification eligibility: a result may skip technologist review only
 * if the test is configured for it AND it's in-range AND no delta flag AND
 * (by convention) it came with a passing instrument QC — QC pass/fail is
 * carried on the instrument message, checked by the caller before this.
 */
export function isAutoVerifyEligible(params: {
  testAutoVerifyEligible: boolean;
  flag: ResultFlag;
  deltaFlagged: boolean;
  instrumentQcPassed: boolean;
}): boolean {
  return (
    params.testAutoVerifyEligible &&
    params.flag === ResultFlag.NORMAL &&
    !params.deltaFlagged &&
    params.instrumentQcPassed
  );
}
