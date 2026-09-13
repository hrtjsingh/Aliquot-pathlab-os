import { derivationInputCodes } from "@/lib/calc-engine";

export type CatalogTest = {
  id: string;
  code: string;
  name: string;
  derivationRule?: string | null;
};

export function expandDerivedInputs(selectedIds: Iterable<string>, tests: CatalogTest[]): string[] {
  const byId = new Map(tests.map((test) => [test.id, test]));
  const byCode = new Map(tests.map((test) => [test.code, test]));
  const result = new Set(selectedIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...result]) {
      const test = byId.get(id);
      if (!test?.derivationRule) continue;
      for (const code of derivationInputCodes(test.derivationRule)) {
        const dep = byCode.get(code);
        if (dep && !result.has(dep.id)) {
          result.add(dep.id);
          changed = true;
        }
      }
    }
  }
  return [...result];
}

export function formulaToDerivationRule(
  formula: string,
  tests: Array<{ name: string; code: string }>
): { ok: true; rule: string | null } | { ok: false; error: string } {
  const trimmed = formula.trim();
  if (!trimmed) return { ok: true, rule: null };
  if (/^[A-Z][A-Z0-9_]*$/.test(trimmed) || trimmed.startsWith("expr:")) return { ok: true, rule: trimmed };

  const nameToCode = new Map(tests.map((test) => [test.name.trim().toLowerCase(), test.code]));
  const refs = [...trimmed.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1].trim());
  let expr = trimmed;
  for (const ref of refs.sort((a, b) => b.length - a.length)) {
    const code = nameToCode.get(ref.toLowerCase());
    if (!code) return { ok: false, error: `Unknown test in formula: ${ref}` };
    expr = expr.split(`[${ref}]`).join(code);
  }
  if (expr.includes("[")) return { ok: false, error: "Formula still contains unresolved [test names]." };
  return { ok: true, rule: `expr:${expr.replace(/\s+/g, " ").trim()}` };
}

export function derivationRuleToFormula(
  rule: string | null | undefined,
  tests: Array<{ name: string; code: string }>
): string {
  if (!rule) return "";
  if (!rule.startsWith("expr:")) return rule;
  let expr = rule.slice(5).trim();
  const codes = [...tests].sort((a, b) => b.code.length - a.code.length);
  for (const test of codes) {
    expr = expr.replace(new RegExp(`\\b${test.code}\\b`, "g"), `[${test.name}]`);
  }
  return expr;
}
