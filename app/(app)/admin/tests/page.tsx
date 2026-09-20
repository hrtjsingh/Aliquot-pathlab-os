import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { AddTestDialog } from "./add-test-dialog";
import { TestsCatalog } from "./tests-catalog.client";
import type { TestProfile } from "@/lib/test-profile";
import { derivationRuleToFormula } from "@/lib/test-deps";
import { asMoney } from "@/lib/money";

export default async function TestMasterPage() {
  const user = await requireTenant();

  if (user.role !== "ADMIN") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
        <PageHeader title="Test master" description="Only administrators can manage the laboratory test catalog." />
      </div>
    );
  }

  const tests = await prisma.test.findMany({
    where: { vendorId: user.vendorId },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: {
      referenceRanges: { orderBy: [{ gender: "asc" }, { ageMinDays: "asc" }] },
      criticalThresholds: true,
      panelTests: { include: { panel: true } },
    },
  });

  const siblings = tests.map((test) => ({ name: test.name, code: test.code }));
  const catalog = tests.map((test) => {
    const profile: TestProfile = {
      id: test.id,
      code: test.code,
      name: test.name,
      shortName: test.shortName,
      category: test.category,
      specimenType: test.specimenType,
      method: test.method,
      loincCode: test.loincCode,
      unit: test.unit,
      turnaroundHours: test.turnaroundHours,
      description: test.description,
      collectionNotes: test.collectionNotes,
      dataType: test.dataType,
      isDerived: test.isDerived,
      autoVerifyEligible: test.autoVerifyEligible,
      price: asMoney(test.price),
      formula: derivationRuleToFormula(test.derivationRule, siblings),
      referenceRanges: test.referenceRanges.map((range) => ({
        id: range.id,
        gender: range.gender,
        ageMinDays: range.ageMinDays,
        ageMaxDays: range.ageMaxDays,
        low: range.low,
        high: range.high,
        isDefault: range.isDefault,
      })),
      criticalThresholds: test.criticalThresholds.map((row) => ({
        id: row.id,
        low: row.low,
        high: row.high,
        gender: row.gender,
      })),
      panels: test.panelTests.map((pt) => ({ code: pt.panel.code, name: pt.panel.name })),
    };
    return { ...profile, active: test.active };
  });

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-6">
      <PageHeader
        title="Test master"
        description="Search the catalog, set charges and formulas, and remove unused tests."
        actions={<AddTestDialog />}
      />
      <TestsCatalog tests={catalog} />
    </div>
  );
}
