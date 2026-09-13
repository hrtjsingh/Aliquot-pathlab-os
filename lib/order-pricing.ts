import { asMoney } from "@/lib/money";

export type PricedPanel = { id: string; price: number | null | undefined; testIds: string[] };
export type PricedTest = { id: string; price: number | null | undefined };

/** Package rate for selected panels, plus a la carte tests that are not already inside those panels. */
export function computeOrderCharge(panels: PricedPanel[], tests: PricedTest[], panelIds: string[], testIds: string[]): number {
  const selectedPanels = panels.filter((panel) => panelIds.includes(panel.id));
  const covered = new Set(selectedPanels.flatMap((panel) => panel.testIds));
  const panelTotal = selectedPanels.reduce((sum, panel) => sum + asMoney(panel.price), 0);
  const extraTotal = tests
    .filter((test) => testIds.includes(test.id) && !covered.has(test.id))
    .reduce((sum, test) => sum + asMoney(test.price), 0);
  return asMoney(panelTotal + extraTotal);
}
