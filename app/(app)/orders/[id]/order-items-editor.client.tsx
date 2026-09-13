"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useDataSync } from "@/components/data-sync";
import { OrderForm } from "@/app/(app)/orders/new/order-form.client";
import { updateOrderItems } from "@/app/actions/orders";

export function OrderItemsEditor({
  orderId,
  patientId,
  referringDoctor,
  discount,
  amountPaid,
  testIds,
  panelIds,
}: {
  orderId: string;
  patientId: string;
  referringDoctor: string;
  discount: number;
  amountPaid: number;
  testIds: string[];
  panelIds: string[];
}) {
  const router = useRouter();
  const { snapshot } = useDataSync();
  if (!snapshot) {
    return (
      <p className="text-sm text-muted-foreground">Tap Sync to load the catalog before changing tests on this accession.</p>
    );
  }

  return (
    <OrderForm
      patients={snapshot.patients}
      panels={snapshot.panels}
      tests={snapshot.tests}
      initialPatientId={patientId}
      initialTestIds={testIds}
      initialPanelIds={panelIds}
      initialDoctor={referringDoctor}
      initialDiscount={discount}
      initialPaid={amountPaid}
      submitLabel="Save tests"
      onSubmitOrder={async (payload) => {
        const result = await updateOrderItems({
          orderId,
          testIds: payload.testIds,
          panelIds: payload.panelIds,
          referringDoctor: payload.referringDoctor,
          discount: payload.discount,
          amountPaid: payload.amountPaid,
        });
        if (!result.ok) return result;
        toast.success("Tests updated.");
        router.refresh();
        return { ok: true as const };
      }}
    />
  );
}
