"use client";

import { useState, useMemo } from "react";
import { formulaToDerivationRule } from "@/lib/test-deps";
import { runCalcRule, derivationInputCodes, CALC_RULES } from "@/lib/calc-engine";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, AlertCircle, CheckCircle2 } from "lucide-react";

export function FormulaTester({
  formula,
  tests = [],
}: {
  formula: string;
  tests?: Array<{ name: string; code: string }>;
}) {
  const [sampleInputs, setSampleInputs] = useState<Record<string, string>>({});

  const parsed = useMemo(() => {
    if (!formula.trim()) return null;
    return formulaToDerivationRule(formula, tests);
  }, [formula, tests]);

  const inputCodes = useMemo(() => {
    if (!parsed || !parsed.ok || !parsed.rule) return [];
    return derivationInputCodes(parsed.rule);
  }, [parsed]);

  const calculationResult = useMemo(() => {
    if (!parsed || !parsed.ok || !parsed.rule) return null;
    const numericMap: Record<string, number | null> = {};
    for (const code of inputCodes) {
      const val = sampleInputs[code];
      numericMap[code] = val !== undefined && val !== "" ? Number(val) : null;
    }
    try {
      const res = runCalcRule(parsed.rule, numericMap, { gender: "MALE", ageYears: 30 });
      return res;
    } catch (err) {
      return { value: null, suppressed: true, suppressReason: err instanceof Error ? err.message : "Calculation error" };
    }
  }, [parsed, inputCodes, sampleInputs]);

  if (!formula.trim()) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-3 text-xs text-muted-foreground bg-slate-50/50 dark:bg-slate-900/50">
        <span className="font-medium text-foreground">Formula Helper:</span> Enter a predefined rule (e.g. <code className="text-primary font-mono font-semibold">EGFR_CKD_EPI_2021</code>, <code className="text-primary font-mono font-semibold">LDL_FRIEDEWALD</code>, <code className="text-primary font-mono font-semibold">MENTZER_INDEX</code>) or a custom formula using test names in brackets, e.g. <code className="text-primary font-mono font-semibold">[Total Protein] - [Albumin]</code>.
      </div>
    );
  }

  if (parsed && !parsed.ok) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-400">
        <AlertCircle className="size-4 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Invalid Formula Syntax:</span> {parsed.error}
        </div>
      </div>
    );
  }

  const isPredefined = parsed?.rule && !parsed.rule.startsWith("expr:") && CALC_RULES[parsed.rule];

  return (
    <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2 border-b border-blue-100 dark:border-blue-900/50 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-950 dark:text-blue-200">
          <Calculator className="size-4 text-blue-600 dark:text-blue-400" />
          <span>Live Formula Tester</span>
          {isPredefined ? (
            <span className="ml-1.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-[10px] font-mono">
              Predefined: {isPredefined.label}
            </span>
          ) : (
            <span className="ml-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-mono">
              Custom Expression
            </span>
          )}
        </div>
      </div>

      {inputCodes.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
            Test inputs required ({inputCodes.join(", ")}):
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {inputCodes.map((code) => {
              const matchedTest = tests.find((t) => t.code === code);
              return (
                <div key={code} className="flex flex-col gap-1">
                  <Label htmlFor={`input-${code}`} className="text-[11px] font-mono text-slate-700 dark:text-slate-300 truncate">
                    {matchedTest ? matchedTest.name : code}
                  </Label>
                  <Input
                    id={`input-${code}`}
                    type="number"
                    step="any"
                    placeholder={`e.g. 10`}
                    className="h-7 text-xs bg-white dark:bg-slate-950"
                    value={sampleInputs[code] ?? ""}
                    onChange={(e) =>
                      setSampleInputs((prev) => ({
                        ...prev,
                        [code]: e.target.value,
                      }))
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between rounded-lg bg-white dark:bg-slate-900 p-2.5 border border-blue-100 dark:border-blue-900/40 text-xs">
        <span className="font-medium text-slate-600 dark:text-slate-400">Calculated Output Result:</span>
        <div className="flex items-center gap-1.5">
          {calculationResult?.value != null ? (
            <span className="font-bold font-mono text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="size-4" />
              {Number(calculationResult.value.toFixed(2))}
            </span>
          ) : calculationResult?.suppressed ? (
            <span className="text-amber-600 dark:text-amber-400 text-xs italic font-mono">
              {calculationResult.suppressReason || "Waiting for all test inputs..."}
            </span>
          ) : (
            <span className="text-slate-400 italic">Enter sample values above</span>
          )}
        </div>
      </div>
    </div>
  );
}

