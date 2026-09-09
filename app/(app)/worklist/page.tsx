import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { InstructionAlert } from "@/components/instruction-alert";
import { WorklistTable } from "./worklist-table.client";

export default async function WorklistPage() {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["ORDER_CREATED", "SAMPLE_COLLECTED", "SAMPLE_RECEIVED", "RESULT_ENTRY", "TECH_VERIFIED", "AUTHORIZED"] },
    },
    include: { patient: true, orderTests: { include: { test: true } } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <PageHeader
        title="Worklist"
        description="All active orders, STAT first. Open an accession to enter results, verify, or release."
        hint={
          <InstructionAlert title="How to move an order">
            Mark collected or received from this table. Result entry, technologist verification, pathologist authorization, and report release happen on the order page.
          </InstructionAlert>
        }
      />
      <Card>
        <CardContent className="p-0">
          <WorklistTable
            orders={orders.map((o) => ({
              id: o.id,
              accessionNo: o.accessionNo,
              status: o.status,
              priority: o.priority,
              patient: { firstName: o.patient.firstName, lastName: o.patient.lastName },
              testCount: o.orderTests.length,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
