"use client";

import { useRouter } from "next/navigation";
import { OrderStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { markSampleCollectedAndReceived, transitionOrderStatus } from "@/app/actions/orders";
import { pathologistAuthorize, releaseReport, technologistVerify } from "@/app/actions/results";
import { HandoverActions } from "./handover-actions.client";
import { isCustomerVisibleReport, isHandoverDone } from "@/lib/workflow";
import { enqueueOp, isBrowserOffline, isNetworkError } from "@/lib/offline/outbox";
import { useDataSync } from "@/components/data-sync";

export function OrderActions({
  orderId,
  status,
  accessionNo,
  role,
  phone,
}: {
  orderId: string;
  status: OrderStatus;
  accessionNo: string;
  role: string;
  phone?: string | null;
}) {
  const router = useRouter();
  const { patchSnapshot } = useDataSync();
  const canTech = role === "TECHNOLOGIST" || role === "ADMIN";
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

  if (status === "RESULT_ENTRY" && canTech) {
    return (
      <ConfirmDialog
        title="Submit for technologist verification?"
        description="All entered results will be locked for pathologist review. If a critical value is open, log the clinician call-back first."
        confirmLabel="Submit for verification"
        successMessage="Results submitted for verification."
        trigger={<Button type="button">Submit for technologist verification</Button>}
        onConfirm={async () => {
          if (isBrowserOffline()) {
            await enqueueOp({ type: "technologistVerify", orderId });
            return { queued: true as const };
          }
          try {
            const res = await technologistVerify(orderId);
            if (!res.ok) return res;
            refresh();
            return res;
          } catch (error) {
            if (isNetworkError(error)) {
              await enqueueOp({ type: "technologistVerify", orderId });
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

  if (status === "AUTHORIZED") {
    return (
      <ConfirmDialog
        title="Release this report?"
        description="The report becomes available to clinicians. Releasing cannot be undone without an amendment."
        confirmLabel="Release report"
        variant="destructive"
        successMessage="Report released."
        trigger={<Button type="button">Release report</Button>}
        onConfirm={async () => {
          if (isBrowserOffline()) {
            await enqueueOp({ type: "releaseReport", orderId });
            return { queued: true as const };
          }
          try {
            await releaseReport(orderId);
            refresh();
          } catch (error) {
            if (isNetworkError(error)) {
              await enqueueOp({ type: "releaseReport", orderId });
              return { queued: true as const };
            }
            throw error;
          }
        }}
      />
    );
  }

  if (isCustomerVisibleReport(status)) {
    return (
      <HandoverActions
        orderId={orderId}
        accessionNo={accessionNo}
        phone={phone ?? null}
        status={status}
        onSent={async () => {
          await patchSnapshot((snapshot) => ({
            ...snapshot,
            worklist: snapshot.worklist.filter((order) => order.id !== orderId),
            dashboard: {
              ...snapshot.dashboard,
              awaitingHandover: Math.max(0, (snapshot.dashboard.awaitingHandover ?? 0) - (status === "RELEASED" ? 1 : 0)),
              recent: snapshot.dashboard.recent.map((order) =>
                order.id === orderId && !isHandoverDone(order.status as OrderStatus)
                  ? { ...order, status: "SENT_TO_CUSTOMER" }
                  : order
              ),
            },
          }));
          refresh();
        }}
        onCollected={async () => {
          await patchSnapshot((snapshot) => ({
            ...snapshot,
            worklist: snapshot.worklist.filter((order) => order.id !== orderId),
            dashboard: {
              ...snapshot.dashboard,
              awaitingHandover: Math.max(0, (snapshot.dashboard.awaitingHandover ?? 0) - (status === "RELEASED" ? 1 : 0)),
              recent: snapshot.dashboard.recent.map((order) =>
                order.id === orderId ? { ...order, status: "COLLECTED_BY_CUSTOMER" } : order
              ),
            },
          }));
          refresh();
        }}
      />
    );
  }

  if (status === "SAMPLE_RECEIVED") {
    return (
      <p className="text-sm text-muted-foreground">
        Enter results in the table. Values save when you leave each field. Then submit for verification.
      </p>
    );
  }

  return null;
}
