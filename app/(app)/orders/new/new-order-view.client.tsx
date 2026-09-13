"use client";

import { PageHeader } from "@/components/page-header";
import { CacheMiss, useDataSync } from "@/components/data-sync";
import { OrderForm } from "./order-form.client";
import NewOrderLoading from "./loading";

export function NewOrderView({ initialPatientId }: { initialPatientId?: string }) {
  const { snapshot } = useDataSync();
  if (!snapshot) return <CacheMiss loading={<NewOrderLoading />} />;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <PageHeader
        title="New order"
        description="Select a patient, add packages or tests, set discount and payment. An accession number is generated when you confirm."
      />
      <OrderForm
        patients={snapshot.patients}
        panels={snapshot.panels}
        tests={snapshot.tests}
        initialPatientId={initialPatientId}
      />
    </div>
  );
}
