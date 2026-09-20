/** Print / entry sequence: catalog sortOrder, then package member idx. */

export const CATEGORY_PRINT_ORDER = [
  "HEMATOLOGY",
  "COAGULATION",
  "CLINICAL_CHEMISTRY",
  "ENDOCRINE",
  "SEROLOGY_IMMUNOLOGY",
  "URINALYSIS",
  "MICROBIOLOGY",
  "MOLECULAR",
  "HISTOPATHOLOGY",
  "CYTOLOGY",
  "OTHER",
] as const;

export function categoryRank(category: string): number {
  const index = CATEGORY_PRINT_ORDER.indexOf(category as (typeof CATEGORY_PRINT_ORDER)[number]);
  return index === -1 ? CATEGORY_PRINT_ORDER.length : index;
}

export function uniqueCategoriesInPrintOrder<T extends { category: string }>(items: T[]): string[] {
  const seen = new Set<string>();
  const ordered = [...items].sort((a, b) => categoryRank(a.category) - categoryRank(b.category));
  const result: string[] = [];
  for (const item of ordered) {
    if (seen.has(item.category)) continue;
    seen.add(item.category);
    result.push(item.category);
  }
  return result;
}

export function compareByPrintOrder<T extends { category: string; sortOrder?: number | null; name?: string }>(a: T, b: T): number {
  const category = categoryRank(a.category) - categoryRank(b.category);
  if (category !== 0) return category;
  const order = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  if (order !== 0) return order;
  return (a.name ?? "").localeCompare(b.name ?? "");
}

/**
 * Snapshot a stable line order onto the order:
 * booked packages stay as contiguous blocks (panel member sortOrder),
 * then a-la-carte tests by catalog sortOrder.
 */
export function resolveOrderLineSort(params: {
  testIds: string[];
  tests: Array<{ id: string; category: string; sortOrder: number }>;
  panels: Array<{ id: string; members: Array<{ testId: string; sortOrder: number }> }>;
  selectedPanelIds: string[];
}): Array<{ testId: string; sortOrder: number }> {
  const byId = new Map(params.tests.map((test) => [test.id, test]));
  const assigned = new Map<string, number>();
  let groupBase = 0;

  for (const panelId of params.selectedPanelIds) {
    const panel = params.panels.find((row) => row.id === panelId);
    if (!panel) continue;
    const members = [...panel.members].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const member of members) {
      if (!params.testIds.includes(member.testId) || assigned.has(member.testId)) continue;
      assigned.set(member.testId, groupBase + member.sortOrder);
    }
    groupBase += 1000;
  }

  const leftover = params.testIds
    .filter((id) => !assigned.has(id))
    .map((id) => {
      const test = byId.get(id);
      return {
        id,
        category: test?.category ?? "OTHER",
        sortOrder: test?.sortOrder ?? 0,
      };
    })
    .sort(compareByPrintOrder);

  leftover.forEach((row, index) => {
    assigned.set(row.id, groupBase + index);
  });

  return params.testIds
    .map((testId) => ({ testId, sortOrder: assigned.get(testId) ?? 0 }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
