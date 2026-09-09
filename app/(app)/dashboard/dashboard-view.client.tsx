"use client";

import Link from "next/link";
import { ClipboardList, FlaskConical } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { InstructionAlert } from "@/components/instruction-alert";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { CacheMiss, useDataSync } from "@/components/data-sync";
import { STATUS_LABELS } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@prisma/client";
import DashboardLoading from "./loading";

const STATUSES = ["SAMPLE_RECEIVED", "RESULT_ENTRY", "TECH_VERIFIED", "AUTHORIZED", "RELEASED"] as const;

export function DashboardView() {
  const { snapshot } = useDataSync();
  if (!snapshot) return <CacheMiss loading={<DashboardLoading />} />;

  const { dashboard } = snapshot;
  const counts = [
    dashboard.sampleReceived,
    dashboard.resultEntry,
    dashboard.techVerified,
    dashboard.authorized,
    dashboard.awaitingHandover ?? 0,
  ];
  const criticalOpen = dashboard.criticalOpen;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <PageHeader
        title="Dashboard"
        description="Lab-wide status at a glance. Open the worklist for today's queue."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={"/worklist" as never}>
                <ClipboardList />
                Open worklist
              </Link>
            </Button>
            <Button asChild>
              <Link href={"/orders/new" as never}>
                <FlaskConical />
                New order
              </Link>
            </Button>
          </>
        }
        hint={
          <InstructionAlert
            variant={criticalOpen > 0 ? "destructive" : "info"}
            title={criticalOpen > 0 ? "Critical values need attention" : "Start of shift"}
          >
            {criticalOpen > 0
              ? `${criticalOpen} open critical value${criticalOpen === 1 ? "" : "s"} are not yet released. Open those orders, log the clinician call-back, then continue verification.`
              : "Use Worklist for samples in progress. Register a patient first if you are creating a new accession. Tap Sync when you want a fresh snapshot."}
          </InstructionAlert>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {STATUSES.map((status, i) => (
          <Link key={status} href={"/worklist" as never} className="block">
            <Card className="h-full transition-colors hover:border-accent/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {status === "RELEASED" ? "Ready to send" : STATUS_LABELS[status]}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-semibold tabular">{counts[i]}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
        <Card className={cn(criticalOpen > 0 && "border-destructive")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Open critical</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className={cn("text-2xl font-semibold tabular", criticalOpen > 0 && "text-destructive")}>{criticalOpen}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Released today</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold tabular">{dashboard.releasedToday}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
          <CardDescription>Newest accessions across the lab. Click a row to open results and workflow actions.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {dashboard.recent.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="size-5" />}
              title="No orders yet"
              description="Create the first accession from New Order after the patient is registered."
              action={
                <Link href={"/orders/new" as never}>
                  <Button>
                    <FlaskConical />
                    New order
                  </Button>
                </Link>
              }
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {dashboard.recent.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/orders/${order.id}` as never}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-secondary/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{order.patientName}</p>
                      <p className="tabular text-xs text-muted-foreground">{order.accessionNo}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={order.priority} />
                      <StatusBadge status={order.status as OrderStatus} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
