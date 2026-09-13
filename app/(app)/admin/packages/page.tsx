import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { InstructionAlert } from "@/components/instruction-alert";
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <PageHeader
        title="Packages"
        description="Create billed panels. The package charge is used on new orders, not the sum of member tests."
        hint={
          <InstructionAlert title="Package rates">
            Add the tests that print on the report, then set the package price. Packages already used on orders are deactivated instead of deleted.
          </InstructionAlert>
        }
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
