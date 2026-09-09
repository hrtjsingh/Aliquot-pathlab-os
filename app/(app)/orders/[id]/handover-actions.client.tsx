"use client";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { markReportCollected, sendReportOnWhatsApp } from "@/app/actions/delivery";
import { enqueueOp, isBrowserOffline, isNetworkError } from "@/lib/offline/outbox";

export function HandoverActions({
  orderId,
  accessionNo,
  phone,
  size = "default",
  onDone,
}: {
  orderId: string;
  accessionNo: string;
  phone: string | null;
  size?: "default" | "sm";
  onDone?: () => Promise<void> | void;
}) {
  const phoneLabel = phone?.trim() || "no registered number";

  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmDialog
        title="Send this report on WhatsApp?"
        description={`Accession ${accessionNo} will be sent to ${phoneLabel}. WhatsApp opens with the patient report link. After you send the message, this order leaves the worklist.`}
        confirmLabel="Send on WhatsApp"
        successMessage="WhatsApp opened with the report link. Marked as sent."
        trigger={
          <Button type="button" size={size}>
            Send on WhatsApp
          </Button>
        }
        onConfirm={async () => {
          if (isBrowserOffline()) {
            await enqueueOp({ type: "sendReportOnWhatsApp", orderId });
            await onDone?.();
            return { queued: true as const };
          }
          try {
            const result = await sendReportOnWhatsApp(orderId);
            if (result.ok) await onDone?.();
            return result;
          } catch (error) {
            if (isNetworkError(error)) {
              await enqueueOp({ type: "sendReportOnWhatsApp", orderId });
              await onDone?.();
              return { queued: true as const };
            }
            throw error;
          }
        }}
      />
      <ConfirmDialog
        title="Mark as collected by the customer?"
        description={`Accession ${accessionNo} was handed over at the counter. It leaves the worklist.`}
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
            await onDone?.();
            return { queued: true as const };
          }
          try {
            const result = await markReportCollected(orderId);
            if (result.ok) await onDone?.();
            return result;
          } catch (error) {
            if (isNetworkError(error)) {
              await enqueueOp({ type: "markReportCollected", orderId });
              await onDone?.();
              return { queued: true as const };
            }
            throw error;
          }
        }}
      />
    </div>
  );
}
