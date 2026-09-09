"use client";

import type { OrderStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { markReportCollected, sendReportOnWhatsApp } from "@/app/actions/delivery";
import { enqueueOp, isBrowserOffline, isNetworkError } from "@/lib/offline/outbox";
import { canMarkCollected } from "@/lib/workflow";

export function HandoverActions({
  orderId,
  accessionNo,
  phone,
  status,
  size = "default",
  onSent,
  onCollected,
}: {
  orderId: string;
  accessionNo: string;
  phone: string | null;
  status: OrderStatus;
  size?: "default" | "sm";
  onSent?: () => Promise<void> | void;
  onCollected?: () => Promise<void> | void;
}) {
  const phoneLabel = phone?.trim() || "no registered number";
  const alreadySent = status === "SENT_TO_CUSTOMER" || status === "COLLECTED_BY_CUSTOMER";
  const showCollect = canMarkCollected(status);

  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmDialog
        title={alreadySent ? "Send this report on WhatsApp again?" : "Send this report on WhatsApp?"}
        description={`Accession ${accessionNo} will be sent to ${phoneLabel}. WhatsApp opens with the patient report link.`}
        confirmLabel="Send on WhatsApp"
        successMessage="WhatsApp opened with the report link."
        trigger={
          <Button type="button" size={size}>
            Send on WhatsApp
          </Button>
        }
        onConfirm={async () => {
          if (isBrowserOffline()) {
            await enqueueOp({ type: "sendReportOnWhatsApp", orderId });
            await onSent?.();
            return { queued: true as const };
          }
          try {
            const result = await sendReportOnWhatsApp(orderId);
            if (result.ok) await onSent?.();
            return result;
          } catch (error) {
            if (isNetworkError(error)) {
              await enqueueOp({ type: "sendReportOnWhatsApp", orderId });
              await onSent?.();
              return { queued: true as const };
            }
            throw error;
          }
        }}
      />
      {showCollect ? (
        <ConfirmDialog
          title="Mark as collected by the customer?"
          description={`Accession ${accessionNo} was handed over at the counter.`}
          confirmLabel="Collected by customer"
          successMessage="Marked as collected."
          trigger={
            <Button type="button" size={size} variant="outline">
              Collected by customer
            </Button>
          }
          onConfirm={async () => {
            if (isBrowserOffline()) {
              await enqueueOp({ type: "markReportCollected", orderId });
              await onCollected?.();
              return { queued: true as const };
            }
            try {
              const result = await markReportCollected(orderId);
              if (result.ok) await onCollected?.();
              return result;
            } catch (error) {
              if (isNetworkError(error)) {
                await enqueueOp({ type: "markReportCollected", orderId });
                await onCollected?.();
                return { queued: true as const };
              }
              throw error;
            }
          }}
        />
      ) : null}
    </div>
  );
}
