"use client";

import Link from "next/link";
import { OrderStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { useDataSync } from "@/components/data-sync";
import { transitionOrderStatus } from "@/app/actions/orders";
import { enqueueOp, isBrowserOffline, isNetworkError } from "@/lib/offline/outbox";
import { HandoverActions } from "@/app/(app)/orders/[id]/handover-actions.client";
import { isHandoverDone } from "@/lib/workflow";

type WorklistOrder = {
  id: string;
  accessionNo: string;
  status: OrderStatus;
  priority: string;
  patient: { firstName: string; lastName: string | null; phone?: string | null };
  testCount: number;
};

const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string; title: string; description: string; success: string }>> = {
  ORDER_CREATED: {
    to: "SAMPLE_COLLECTED",
    label: "Mark collected",
    title: "Mark sample collected?",
    description: "Confirm the specimen is drawn and labeled with this accession number. This moves the order to Sample Collected.",
    success: "Sample marked collected.",
  },
  SAMPLE_COLLECTED: {
    to: "SAMPLE_RECEIVED",
    label: "Mark received",
    title: "Mark sample received in lab?",
    description: "Confirm the specimen arrived at the bench and is ready for result entry.",
    success: "Sample marked received.",
  },
};

export function WorklistTable({ orders }: { orders: WorklistOrder[] }) {
  const { patchSnapshot } = useDataSync();

  async function applyStatus(orderId: string, status: OrderStatus) {
    await patchSnapshot((snapshot) => ({
      ...snapshot,
      worklist: isHandoverDone(status)
          ? snapshot.worklist.filter((order) => order.id !== orderId)
          : snapshot.worklist.map((order) => (order.id === orderId ? { ...order, status } : order)),
      dashboard: {
        ...snapshot.dashboard,
        awaitingHandover: isHandoverDone(status)
            ? Math.max(0, (snapshot.dashboard.awaitingHandover ?? 0) - 1)
            : snapshot.dashboard.awaitingHandover,
      },
    }));
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="size-5" />}
        title="No active orders"
        description="When an order is created, it appears here until the report is sent on WhatsApp or collected."
        action={
          <Link href={"/orders/new" as never}>
            <Button>Create an order</Button>
          </Link>
        }
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Accession</TableHead>
          <TableHead>Patient</TableHead>
          <TableHead>Tests</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((o) => {
          const next = NEXT[o.status];
          return (
            <TableRow key={o.id}>
              <TableCell className="tabular text-xs">{o.accessionNo}</TableCell>
              <TableCell className="font-medium">
                {o.patient.firstName} {o.patient.lastName}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{o.testCount} tests</TableCell>
              <TableCell>
                <PriorityBadge priority={o.priority} />
              </TableCell>
              <TableCell>
                <StatusBadge status={o.status} />
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  {o.status === "RELEASED" ? (
                    <HandoverActions
                      orderId={o.id}
                      accessionNo={o.accessionNo}
                      phone={o.patient.phone ?? null}
                      status={o.status}
                      size="sm"
                      onSent={() => applyStatus(o.id, "SENT_TO_CUSTOMER")}
                      onCollected={() => applyStatus(o.id, "COLLECTED_BY_CUSTOMER")}
                    />
                  ) : next ? (
                    <ConfirmDialog
                      title={next.title}
                      description={`${next.description} Accession ${o.accessionNo}.`}
                      confirmLabel={next.label}
                      successMessage={next.success}
                      trigger={
                        <Button size="sm" variant="secondary" type="button">
                          {next.label}
                        </Button>
                      }
                      onConfirm={async () => {
                        if (isBrowserOffline()) {
                          await enqueueOp({ type: "transitionOrderStatus", orderId: o.id, to: next.to });
                          await applyStatus(o.id, next.to);
                          return { queued: true as const };
                        }
                        try {
                          await transitionOrderStatus(o.id, next.to);
                          await applyStatus(o.id, next.to);
                        } catch (error) {
                          if (isNetworkError(error)) {
                            await enqueueOp({ type: "transitionOrderStatus", orderId: o.id, to: next.to });
                            await applyStatus(o.id, next.to);
                            return { queued: true as const };
                          }
                          throw error;
                        }
                      }}
                    />
                  ) : null}
                  <Button asChild size="sm">
                    <Link href={`/orders/${o.id}` as never}>Open</Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
