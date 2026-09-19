"use client";

import { useRouter } from "next/navigation";
import { OrderStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { markSampleCollectedAndReceived, transitionOrderStatus } from "@/app/actions/orders";
import { pathologistAuthorize } from "@/app/actions/results";
import { enqueueOp, isBrowserOffline, isNetworkError } from "@/lib/offline/outbox";

export function OrderActions({
  orderId,
  status,
  accessionNo,
  role,
}: {
  orderId: string;
  status: OrderStatus;
  accessionNo: string;
  role: string;
  phone?: string | null;
}) {
  const router = useRouter();
  const canPath = role === "PATHOLOGIST" || role === "ADMIN";

  function refresh() {
    router.refresh();
  }

  if (status === "ORDER_CREATED") {
    return (
      <ConfirmDialog
        title="Mark sample collected and received?"
        description={`This records collection and lab receipt for accession ${accessionNo} in one step. Use this when the specimen is already on the bench.`}
        confirmLabel="Mark collected and received"
        successMessage="Sample collected and received."
        trigger={<Button type="button">Mark sample collected and received</Button>}
        onConfirm={async () => {
          if (isBrowserOffline()) {
            await enqueueOp({ type: "markSampleCollectedAndReceived", orderId });
            return { queued: true as const };
          }
          try {
            await markSampleCollectedAndReceived(orderId);
            refresh();
          } catch (error) {
            if (isNetworkError(error)) {
              await enqueueOp({ type: "markSampleCollectedAndReceived", orderId });
              return { queued: true as const };
            }
            throw error;
          }
        }}
      />
    );
  }

  if (status === "SAMPLE_COLLECTED") {
    return (
      <ConfirmDialog
        title="Mark sample received?"
        description={`Confirm accession ${accessionNo} has arrived in the lab and is ready for result entry.`}
        confirmLabel="Mark received"
        successMessage="Sample marked received."
        trigger={<Button type="button">Mark sample received</Button>}
        onConfirm={async () => {
          if (isBrowserOffline()) {
            await enqueueOp({ type: "transitionOrderStatus", orderId, to: OrderStatus.SAMPLE_RECEIVED });
            return { queued: true as const };
          }
          try {
            await transitionOrderStatus(orderId, OrderStatus.SAMPLE_RECEIVED);
            refresh();
          } catch (error) {
            if (isNetworkError(error)) {
              await enqueueOp({ type: "transitionOrderStatus", orderId, to: OrderStatus.SAMPLE_RECEIVED });
              return { queued: true as const };
            }
            throw error;
          }
        }}
      />
    );
  }

  if (status === "TECH_VERIFIED" && canPath) {
    return (
      <ConfirmDialog
        title="Authorize this report?"
        description={`You are signing accession ${accessionNo} as pathologist. The report can then be released to clinicians.`}
        confirmLabel="Authorize"
        successMessage="Report authorized."
        trigger={<Button type="button">Authorize as pathologist</Button>}
        onConfirm={async () => {
          if (isBrowserOffline()) {
            await enqueueOp({ type: "pathologistAuthorize", orderId });
            return { queued: true as const };
          }
          try {
            await pathologistAuthorize(orderId, {});
            refresh();
          } catch (error) {
            if (isNetworkError(error)) {
              await enqueueOp({ type: "pathologistAuthorize", orderId });
              return { queued: true as const };
            }
            throw error;
          }
        }}
      />
    );
  }

  return null;
}
