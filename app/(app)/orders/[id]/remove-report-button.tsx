"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { removeReleasedReport } from "@/app/actions/results";
import { useDataSync } from "@/components/data-sync";

export function RemoveReportButton({
  orderId,
  accessionNo,
  afterHref,
}: {
  orderId: string;
  accessionNo: string;
  afterHref?: string;
}) {
  const router = useRouter();
  const { patchSnapshot } = useDataSync();

  return (
    <ConfirmDialog
      title="Remove this released report?"
      description={`Accession ${accessionNo} will no longer have a downloadable report. The order returns to authorized so it can be released again. This is recorded in the audit log.`}
      confirmLabel="Remove report"
      variant="destructive"
      successMessage="Report removed."
      trigger={
        <Button type="button" size="sm" variant="outline">
          Remove report
        </Button>
      }
      onConfirm={async () => {
        const result = await removeReleasedReport(orderId);
        if (!result.ok) return result;
        await patchSnapshot((snapshot) => {
          const recent = snapshot.dashboard.recent.find((order) => order.id === orderId);
          const alreadyQueued = snapshot.worklist.some((order) => order.id === orderId);
          const nameParts = recent?.patientName.split(" ") ?? [];
          const worklist = alreadyQueued
            ? snapshot.worklist.map((order) => (order.id === orderId ? { ...order, status: "AUTHORIZED" } : order))
            : recent
              ? [
                  {
                    id: orderId,
                    accessionNo,
                    status: "AUTHORIZED",
                    priority: recent.priority,
                    patient: { firstName: nameParts[0] ?? accessionNo, lastName: nameParts.slice(1).join(" ") || null, phone: null },
                    testCount: 0,
                  },
                  ...snapshot.worklist,
                ]
              : snapshot.worklist;
          return {
            ...snapshot,
            worklist,
            dashboard: {
              ...snapshot.dashboard,
              authorized: snapshot.dashboard.authorized + 1,
              awaitingHandover: Math.max(0, (snapshot.dashboard.awaitingHandover ?? 0) - 1),
              releasedToday: Math.max(0, snapshot.dashboard.releasedToday - 1),
              recent: snapshot.dashboard.recent.map((order) =>
                order.id === orderId ? { ...order, status: "AUTHORIZED" } : order
              ),
            },
          };
        });
        if (afterHref) router.push(afterHref as never);
        else router.refresh();
        return result;
      }}
    />
  );
}
