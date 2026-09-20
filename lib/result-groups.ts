/** Group description printed under each booked group. */

export const PANEL_DESCRIPTIONS: Record<string, string> = {
  CBC: "Complete Blood Count. Specimen: EDTA whole blood.",
  LFT: "Liver Function Test. Specimen: Serum.",
  KFT: "Kidney Function Test. Specimen: Serum.",
  LIPID: "Lipid Profile. Specimen: Serum (12-hour fasting preferred).",
  TFT: "Thyroid Function Test. Specimen: Serum.",
  FREE_TFT: "Free Thyroid Profile. Specimen: Serum.",
  COAG: "Coagulation Profile. Specimen: Citrate plasma.",
  WIDAL_TUBE: "Widal tube agglutination. Titre ≥ 1:80 is considered significant; correlate clinically.",
  URINE_ROUTINE: "Complete urine examination. Specimen: Fresh mid-stream urine.",
  DENGUE_ELISA: "Dengue ELISA. Specimen: Serum.",
};

export function panelDescription(code: string | null | undefined, fallback?: string | null): string | null {
  if (code && PANEL_DESCRIPTIONS[code]) return PANEL_DESCRIPTIONS[code];
  const text = fallback?.trim();
  return text || null;
}

export function prettyCategory(category: string): string {
  return category.replaceAll("_", " ");
}

export type PrintGroupMember = {
  testId: string;
  category: string;
  name: string;
};

export type AssignedGroup<T extends PrintGroupMember> = T & {
  groupKey: string;
  groupLabel: string;
  groupDescription: string | null;
  memberOrder: number;
};

/** Booked packages stay contiguous blocks. Leftovers group by category. */
export function assignPrintGroups<T extends PrintGroupMember>(
  rows: T[],
  orderPanels: Array<{
    panel: {
      code: string;
      name: string;
      description?: string | null;
      panelTests: Array<{ testId: string; sortOrder?: number }>;
    };
  }>
): AssignedGroup<T>[] {
  const owner = new Map<string, { key: string; label: string; description: string | null; memberOrder: number }>();
  for (const row of orderPanels) {
    const metaBase = {
      key: `panel:${row.panel.code}`,
      label: row.panel.name,
      description: panelDescription(row.panel.code, row.panel.description),
    };
    row.panel.panelTests.forEach((member, index) => {
      if (owner.has(member.testId)) return;
      owner.set(member.testId, { ...metaBase, memberOrder: member.sortOrder ?? index });
    });
  }
  return rows.map((row, index) => {
    const group = owner.get(row.testId);
    if (group) {
      return {
        ...row,
        groupKey: group.key,
        groupLabel: group.label,
        groupDescription: group.description,
        memberOrder: group.memberOrder,
      };
    }
    return {
      ...row,
      groupKey: `cat:${row.category}`,
      groupLabel: prettyCategory(row.category),
      groupDescription: null,
      memberOrder: index,
    };
  });
}

export function groupsInPrintOrder<T extends { groupKey: string; groupLabel: string; groupDescription: string | null; memberOrder?: number }>(
  rows: T[]
): Array<{ key: string; label: string; description: string | null; rows: T[] }> {
  const map = new Map<string, { key: string; label: string; description: string | null; rows: T[] }>();
  for (const row of rows) {
    const existing = map.get(row.groupKey);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    map.set(row.groupKey, {
      key: row.groupKey,
      label: row.groupLabel,
      description: row.groupDescription,
      rows: [row],
    });
  }
  for (const group of map.values()) {
    group.rows.sort((a, b) => (a.memberOrder ?? 0) - (b.memberOrder ?? 0));
  }
  return [...map.values()];
}
