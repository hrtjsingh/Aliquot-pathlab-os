import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { listPanelsForAdmin } from "@/app/actions/packages";
import { PackagesAdmin } from "./packages-admin.client";
import { asMoney } from "@/lib/money";

export default async function PackagesPage() {
  const user = await requireTenant();
  if (user.role !== "ADMIN") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
        <PageHeader title="Packages" description="Only administrators can manage packages." />
      </div>
    );
  }

  const [panels, tests] = await Promise.all([
    listPanelsForAdmin(),
    prisma.test.findMany({
      where: { vendorId: user.vendorId, active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true, category: true },
    }),
  ]);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-6">
      <PageHeader
        title="Packages"
        description="Create billed panels. The package charge is used on new orders, not the sum of member tests."
      />
      <PackagesAdmin
        panels={panels.map((panel) => ({
          id: panel.id,
          code: panel.code,
          name: panel.name,
          category: panel.category,
          price: asMoney(panel.price),
          active: panel.active,
          testIds: panel.panelTests.map((member) => member.testId),
          tests: panel.panelTests.map((member) => ({
            id: member.test.id,
            code: member.test.code,
            name: member.test.name,
          })),
        }))}
        tests={tests}
      />
    </div>
  );
}
