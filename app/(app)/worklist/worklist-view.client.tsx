"use client";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { InstructionAlert } from "@/components/instruction-alert";
import { CacheMiss, useDataSync } from "@/components/data-sync";
import { WorklistTable } from "./worklist-table.client";
import WorklistLoading from "./loading";
import type { OrderStatus } from "@prisma/client";

export function WorklistView() {
  const { snapshot } = useDataSync();
  if (!snapshot) return <CacheMiss loading={<WorklistLoading />} />;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <PageHeader
        title="Worklist"
        description="Active accessions, STAT first. Released reports stay here until they are sent on WhatsApp or collected."
        hint={
          <InstructionAlert title="How to move an order">
            Mark collected or received from this table. After release, send the report on WhatsApp to the patient’s registered number or mark it collected. Result entry and authorization happen on the order page.
          </InstructionAlert>
        }
      />
      <Card>
        <CardContent className="p-0">
          <WorklistTable
            orders={snapshot.worklist.map((order) => ({
              id: order.id,
              accessionNo: order.accessionNo,
              status: order.status as OrderStatus,
              priority: order.priority,
              patient: order.patient,
              testCount: order.testCount,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
